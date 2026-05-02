import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PHYSICS, DIMENSIONS, COLORS } from './constants';
import { GameConfig, GameEventCallback } from './types';
import { soundManager } from './soundManager';

export class GameEngine {
  // Config
  public static DEBUG_EMPTY_POOL = 0;
  public static DEBUG_AUTOPLAY = 0;
  public static DEBUG_MAX_SPEED = 0;
  public static DEBUG_COLLIDERS = 0;
  public static DEBUG_HIDE_CABINET = 0;
  public static DEBUG_POLYGONS = 0;
  public static DEBUG_CONTROLS = 0;
  public static DEBUG_FPS = 0;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private world!: RAPIER.World;

  // Physics Objects
  private pusherBody!: RAPIER.RigidBody;
  private coinProto!: THREE.Mesh;
  private coinInstancedMesh!: THREE.InstancedMesh;
  private coinBodies: { body: RAPIER.RigidBody; id: number }[] = [];

  // State
  private isInitialized = false;
  private isDisposed = false;
  private isPaused = false;
  private requestAnimationId: number | null = null;
  private lastTime = 0;
  private accumulatedTime = 0;
  private simulationTime = 0;
  private frameCount = 0;
  private lastFpsTime = 0;

  private onGameStateUpdate?: GameEventCallback;

  // Game Variables
  private score = 0;
  private balance = 100; // Start with 100 free DEBRIS tokens to try the game
  private netProfit = 0;
  private coinsCollectedRecently = 0;
  private lastCollectionTime = 0;

  // Raycasting for input
  private raycaster = new THREE.Raycaster();

  // Rain event state (visual rendering handled by RainOverlay component)
  private _isRaining = false;
  private rainTimer = 0;
  private nextRainEvent = 30 + Math.random() * 60; // first rain in 30-90s
  private onRainChange?: (raining: boolean) => void;

  // Reusable object for syncing transforms (avoids per-frame allocation)
  private dummy = new THREE.Object3D();

  constructor(config: Partial<GameConfig>) {
    // Apply config overrides if needed
    if (config.debugEmptyPool) GameEngine.DEBUG_EMPTY_POOL = 1;
    if (config.debugAutoplay) GameEngine.DEBUG_AUTOPLAY = 1;
  }

  public async initialize(
    canvas: HTMLCanvasElement,
    onUpdate: GameEventCallback
  ): Promise<void> {
    this.onGameStateUpdate = onUpdate;

    // 1. Init Physics (with timeout to prevent hanging on WASM load failure)
    await Promise.race([
      RAPIER.init(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('RAPIER WASM init timed out after 10s')), 10_000)),
    ]);
    this.world = new RAPIER.World(PHYSICS.GRAVITY);
    this.world.numSolverIterations = 8;

    // 2. Init Three.js
    this.scene = new THREE.Scene();
    // Transparent background — Lumia Pegboard shows through
    this.scene.background = null;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    // Moderate top-down angle — back wall top edge at ~50% screen height
    // Full playfield depth visible, front lip at bottom of frame
    this.camera.position.set(0, 5, 12);
    this.camera.lookAt(0, 1.8, -4);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
      stencil: false,
      depth: true
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Adjusted Tone Mapping for a brighter image
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;

    // 3. Lighting (Brightened)

    // Hemisphere Light — green-tinted sky, deep green ground
    const hemiLight = new THREE.HemisphereLight(0xccffcc, 0x0d3d24, 1.5);
    this.scene.add(hemiLight);

    // Main Spotlight — cool green-white
    const dirLight = new THREE.SpotLight(COLORS.LIGHT_MAIN, 1000);
    dirLight.position.set(5, 18, 5);
    dirLight.angle = Math.PI / 3;
    dirLight.penumbra = 0.2;
    dirLight.decay = 1.5;
    dirLight.distance = 60;
    dirLight.castShadow = true;
    dirLight.shadow.bias = -0.0001;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    this.scene.add(dirLight);

    // Fill Light — purple tint (Oscar Purple accent)
    const fillLight = new THREE.DirectionalLight(0x9945FF, 0.6);
    fillLight.position.set(-5, 10, -5);
    this.scene.add(fillLight);

    // Accent Light — Oscar Magenta brand accent
    const accentLight = new THREE.PointLight(0xFF00FF, 80, 20);
    accentLight.position.set(0, 3, -2);
    this.scene.add(accentLight);

    // Neon Green point light for brand glow
    const greenAccent = new THREE.PointLight(0x0099ff, 40, 15);
    greenAccent.position.set(0, 2, 3);
    this.scene.add(greenAccent);

    // 4. Build Level
    this.buildStaticGeometry();
    this.buildOcclusionPanel();
    this.buildPusher();
    this.initCoinSystem();

    // 5. Initial Pool
    if (!GameEngine.DEBUG_EMPTY_POOL) {
      this.spawnInitialCoins();
    }

    this.isInitialized = true;
    if (this.isDisposed) return;
    this.startLoop();
  }

  private makeGrungeTexture(size: number, baseColor: string, stainColor: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Base fill
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, size, size);

    // Random stains and splotches
    for (let i = 0; i < 60; i++) {
      ctx.globalAlpha = Math.random() * 0.15 + 0.03;
      ctx.fillStyle = stainColor;
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = Math.random() * size * 0.15 + 4;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * (0.5 + Math.random()), Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    // Scratches
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = '#000000';
    for (let i = 0; i < 20; i++) {
      ctx.lineWidth = Math.random() * 2 + 0.5;
      ctx.beginPath();
      ctx.moveTo(Math.random() * size, Math.random() * size);
      ctx.lineTo(Math.random() * size, Math.random() * size);
      ctx.stroke();
    }

    // Noise grain
    ctx.globalAlpha = 1;
    const imgData = ctx.getImageData(0, 0, size, size);
    for (let i = 0; i < imgData.data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 18;
      imgData.data[i] += noise;
      imgData.data[i + 1] += noise;
      imgData.data[i + 2] += noise;
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  private makeCookieTexture(size: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Cookie base - golden brown
    const gradient = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
    gradient.addColorStop(0, '#E5B87A');
    gradient.addColorStop(0.7, '#D4A574');
    gradient.addColorStop(1, '#C09060');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    // Add chocolate chips
    const chipCount = 12 + Math.floor(Math.random() * 8);
    for (let i = 0; i < chipCount; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const radius = 8 + Math.random() * 12;
      
      // Chocolate chip with highlight
      ctx.fillStyle = '#4A2511';
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      
      // Highlight
      ctx.fillStyle = '#6B3A1E';
      ctx.beginPath();
      ctx.arc(x - radius * 0.3, y - radius * 0.3, radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Add texture/crumbs
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 100; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#C09060' : '#B88050';
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = Math.random() * 3;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  private buildStaticGeometry() {
    const pfWidth = DIMENSIONS.PLAYFIELD_WIDTH;
    const pfLength = DIMENSIONS.PLAYFIELD_LENGTH;
    const pfThickness = 1;

    // Floor Material — stained, grimy metal
    const floorTex = this.makeGrungeTexture(256, '#1a2a1a', '#0d1a0d');
    floorTex.repeat.set(2, 2);
    const floorMat = new THREE.MeshStandardMaterial({
      color: COLORS.FLOOR,
      map: floorTex,
      roughness: 0.65,
      metalness: 0.5,
    });

    // Geometry
    const floorGeo = new THREE.BoxGeometry(pfWidth, pfThickness, pfLength);
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.y = -pfThickness / 2;
    floorMesh.receiveShadow = true;
    this.scene.add(floorMesh);

    // Physics
    const floorBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, -pfThickness / 2, 0);
    const floorBody = this.world.createRigidBody(floorBodyDesc);
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(pfWidth / 2, pfThickness / 2, pfLength / 2)
        .setFriction(PHYSICS.COIN_FRICTION) // Match coin friction for consistent sliding
        .setContactSkin(0.015),
      floorBody
    );

    // Walls — rusted, stained metal
    const wallThickness = 0.5;
    const wallHeight = DIMENSIONS.WALL_HEIGHT;
    const wallTex = this.makeGrungeTexture(256, '#1a3a2a', '#0a1f12');
    wallTex.repeat.set(3, 1);
    const wallMat = new THREE.MeshStandardMaterial({
      color: COLORS.CABINET,
      map: wallTex,
      roughness: 0.75,
      metalness: 0.3
    });

    const createWall = (x: number, z: number, w: number, l: number) => {
      const geo = new THREE.BoxGeometry(w, wallHeight, l);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(x, wallHeight / 2, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (!GameEngine.DEBUG_HIDE_CABINET) this.scene.add(mesh);

      const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, wallHeight / 2, z);
      const body = this.world.createRigidBody(bodyDesc);
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(w / 2, wallHeight / 2, l / 2).setFriction(0.1), // Low friction walls so coins don't climb
        body
      );
    };

    createWall(-pfWidth / 2 - wallThickness / 2, 0, wallThickness, pfLength);
    createWall(pfWidth / 2 + wallThickness / 2, 0, wallThickness, pfLength);
    createWall(0, -pfLength / 2 - wallThickness / 2, pfWidth + wallThickness * 2, wallThickness);

  }

  private buildOcclusionPanel() {
    const pfWidth = DIMENSIONS.PLAYFIELD_WIDTH;
    const wallHeight = DIMENSIONS.WALL_HEIGHT;
    const rearWallZ = -DIMENSIONS.PLAYFIELD_LENGTH / 2;

    // Panel dimensions: wider and taller than the opening for FOV safety
    const panelWidth = pfWidth + 4;      // Extra 2 units on each side
    const panelHeight = wallHeight + 3;  // Extra 1.5 units top and bottom
    const panelDepth = 5;                // Deep enough to hide any overextension

    // Position: centered behind the rear wall opening
    const panelZ = rearWallZ - panelDepth / 2;  // -5 - 2.5 = -7.5
    const panelY = wallHeight / 2;               // Centered vertically on wall

    // Create transparent material so background image shows through
    const occlusionMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      side: THREE.FrontSide,
      fog: false,
      transparent: true,
      opacity: 0,
      depthWrite: true,
      depthTest: true,
      colorWrite: false,
    });

    // Create geometry
    const occlusionGeo = new THREE.BoxGeometry(panelWidth, panelHeight, panelDepth);
    const occlusionMesh = new THREE.Mesh(occlusionGeo, occlusionMat);

    // Position in world space
    occlusionMesh.position.set(0, panelY, panelZ);

    // Disable all lighting and shadow interactions
    occlusionMesh.castShadow = false;
    occlusionMesh.receiveShadow = false;
    occlusionMesh.matrixAutoUpdate = true;

    // Add to scene
    this.scene.add(occlusionMesh);

    // NO physics collider - purely visual occlusion only
  }

  private buildPusher() {
    const width = 8; // Keep pusher at original width while playfield is wider
    const height = 1;

    // --- Geometry math (movement logic is NOT changed) ---
    // Body pivot at rest: Z = -PLAYFIELD_LENGTH/2 + 2 = -3
    // Max backward (pivot): -3 + PUSHER_AMPLITUDE = -1.9
    // Rear wall inner face: Z = -PLAYFIELD_LENGTH/2 = -5
    //
    // We need the rear face of the pusher to always reach Z = -5.
    // Worst case is max-backward where pivot = -1.9.
    //   rearHalf >= |-1.9 - (-5)| = 3.1
    // Keep the front half-extent the same as before (2.0) so the
    // pushing face doesn't change position.
    const frontHalf = 2.0;                              // original front half-extent (unchanged)
    const neededRearHalf = 2 + PHYSICS.PUSHER_AMPLITUDE; // 3.1 — guarantees rear face reaches back wall
    const totalLength = frontHalf + neededRearHalf;      // 5.1
    const zOffset = -(neededRearHalf - frontHalf) / 2;   // -0.55  (shifts geometry toward rear only)

    // --- Visible mesh: sized to totalLength, offset so front face stays put ---
    const geo = new THREE.BoxGeometry(width, height, totalLength);
    geo.translate(0, 0, zOffset);  // shift verts backward in local space
    
    // Realistic stainless steel material (PBR)
    // Color: neutral stainless steel (light silver-gray)
    // Metalness: 0.9 (highly metallic)
    // Roughness: 0.35 (brushed, not mirror-like)
    const mat = new THREE.MeshStandardMaterial({
      color: 0xc0c0c0,        // Neutral stainless steel color
      metalness: 0.9,         // Highly metallic for realistic metal appearance
      roughness: 0.35,        // Brushed finish (not mirror-like)
      envMapIntensity: 1.0,   // Respond to environment lighting
      side: THREE.FrontSide   // Only front-facing surfaces
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    
    // Store the mesh for later rotation application in syncGraphics
    this.scene.add(mesh);

    // --- Rigid body (position & movement are UNCHANGED) ---
    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(0, height / 2 + 0.05, -DIMENSIONS.PLAYFIELD_LENGTH / 2 + 2);
    this.pusherBody = this.world.createRigidBody(bodyDesc);

    // Single collider matching the extended mesh, offset the same way
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(width / 2, height / 2, totalLength / 2)
        .setTranslation(0, 0, zOffset)
        .setFriction(PHYSICS.COIN_FRICTION),
      this.pusherBody
    );

    mesh.userData = { rigidBody: this.pusherBody };
    (this.pusherBody as any).mesh = mesh;
  }

  private initCoinSystem() {
    const geometry = new THREE.CylinderGeometry(
      PHYSICS.COIN_RADIUS,
      PHYSICS.COIN_RADIUS,
      PHYSICS.COIN_HEIGHT,
      32
    );

    // Create cartoon cookie texture
    const cookieTexture = this.makeCookieTexture(512);

    // Cookie colors: golden brown base with chocolate chips
    const cookieColor = 0xD4A574; // Golden cookie color
    const edgeColor = 0xC09060;   // Darker edge color

    // Create materials for the cylinder: [side, top, bottom]
    const sideMaterial = new THREE.MeshStandardMaterial({
      color: edgeColor,
      roughness: 0.8,
      metalness: 0.0,
    });

    const faceMaterial = new THREE.MeshStandardMaterial({
      color: 0xFFFFFF, // White to show texture colors accurately
      map: cookieTexture,
      roughness: 0.7,
      metalness: 0.0,
    });

    const backFaceMaterial = new THREE.MeshStandardMaterial({
      color: 0xFFFFFF, // White to show texture colors accurately
      map: cookieTexture,
      roughness: 0.7,
      metalness: 0.0,
    });

    const materials = [sideMaterial, faceMaterial, backFaceMaterial];

    this.coinProto = new THREE.Mesh(geometry, materials);
    this.coinProto.castShadow = true;
    this.coinProto.receiveShadow = true;

    this.coinInstancedMesh = new THREE.InstancedMesh(
      geometry,
      materials,
      PHYSICS.MAX_COINS
    );
    this.coinInstancedMesh.castShadow = true;
    this.coinInstancedMesh.receiveShadow = true;
    this.scene.add(this.coinInstancedMesh);
  }

  private spawnInitialCoins() {
    // Fill the pusher surface with coins on initial load
    // These coins are NOT deducted from balance - they're a free sample
    const pfW = DIMENSIONS.PLAYFIELD_WIDTH;
    const pfL = DIMENSIONS.PLAYFIELD_LENGTH;
    const coinSpacing = 1.25; // Must exceed coin diameter (1.1) to prevent overlap jitter
    const margin = 0.7;

    // Grid across playfield: x from left+margin to right-margin, z from back+margin to front-margin
    for (let x = -pfW / 2 + margin; x <= pfW / 2 - margin; x += coinSpacing) {
      for (let z = -pfL / 2 + margin; z <= pfL / 2 - margin; z += coinSpacing) {
        // Small random offset to look natural
        const jx = x + (Math.random() - 0.5) * 0.3;
        const jz = z + (Math.random() - 0.5) * 0.3;
        this.spawnCoin(jx, 0.5 + Math.random() * 0.3, jz);
      }
    }
  }

  private spawnCoin(x: number, y: number, z: number) {
    if (this.coinBodies.length >= PHYSICS.MAX_COINS) return;

    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(x, y, z)
      .setLinearDamping(PHYSICS.COIN_LINEAR_DAMPING)
      .setAngularDamping(PHYSICS.COIN_ANGULAR_DAMPING)
      .setCanSleep(true);

    const body = this.world.createRigidBody(bodyDesc);
    this.world.createCollider(
      RAPIER.ColliderDesc.cylinder(PHYSICS.COIN_HEIGHT / 2, PHYSICS.COIN_RADIUS)
        .setRestitution(PHYSICS.COIN_RESTITUTION)
        .setFriction(PHYSICS.COIN_FRICTION)
        .setDensity(PHYSICS.COIN_DENSITY),
      body
    );

    const id = this.coinBodies.length;
    this.coinBodies.push({ body, id });
  }

  public dropUserCoin(normalizedX: number) {
    if (this.balance <= 0 && !GameEngine.DEBUG_AUTOPLAY) return;

    if (!GameEngine.DEBUG_AUTOPLAY) {
      this.balance--;
      this.netProfit--;
    }
    this.updateGameState();

    // Play coin drop sound
    soundManager.play('coin_drop');

    if (this.balance <= 0 && !GameEngine.DEBUG_AUTOPLAY) {
      soundManager.play('out_of_tokens');
    }

    const z = -DIMENSIONS.PLAYFIELD_LENGTH / 2 + 1;
    this.spawnCoin(normalizedX, 4, z);
  }

  /** Drop a bonus coin that does NOT deduct from the player's balance */
  public dropBonusCoin() {
    const x = (Math.random() - 0.5) * 6;
    const z = -DIMENSIONS.PLAYFIELD_LENGTH / 2 + 1 + (Math.random() - 0.5) * 2;
    this.spawnCoin(x, 4 + Math.random() * 2, z);
    soundManager.play('coin_drop');
  }

  public dropCoinAtRaycast(ndcX: number, ndcY: number) {
    this.raycaster.setFromCamera({ x: ndcX, y: ndcY }, this.camera);
    const dropPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -3);
    const target = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(dropPlane, target);

    const limit = DIMENSIONS.PLAYFIELD_WIDTH / 2 - 0.5;
    const x = Math.max(-limit, Math.min(limit, target.x));

    this.dropUserCoin(x);
  }

  /** Add tokens to the engine's internal balance (e.g. after an on-chain deposit) */
  public addBalance(amount: number) {
    this.balance += amount;
    this.updateGameState();
  }

  /** Overwrite the engine's balance/score/netProfit (e.g. restoring saved state) */
  public restoreState(balance: number, score: number, netProfit: number) {
    this.balance = balance;
    this.score = score;
    this.netProfit = netProfit;
    this.updateGameState();
  }

  public bump() {
    // Apply fee (50 DEBRIS)
    this.balance -= 50;

    this.updateGameState();

    // Play bump sound
    soundManager.play('bump');

    if (this.balance <= 0) {
      soundManager.play('out_of_tokens');
    }

    // Bump physics parameters
    // We want a strong vertical pop with some chaotic lateral movement
    const verticalImpulseBase = 1.0;
    const lateralImpulseBase = 0.5;

    const applyBumpTo = (bodies: { body: RAPIER.RigidBody; id: number }[]) => {
      bodies.forEach(({ body }) => {
        body.wakeUp();
        const ix = (Math.random() - 0.5) * lateralImpulseBase;
        const iy = verticalImpulseBase + Math.random() * 1.5;
        const iz = (Math.random() - 0.5) * lateralImpulseBase;
        body.applyImpulse({ x: ix, y: iy, z: iz }, true);
        body.applyTorqueImpulse({
          x: (Math.random() - 0.5) * 0.1,
          y: (Math.random() - 0.5) * 0.1,
          z: (Math.random() - 0.5) * 0.1
        }, true);
      });
    };
    applyBumpTo(this.coinBodies);
  }

  private updateGameState() {
    if (this.onGameStateUpdate) {
      this.onGameStateUpdate({
        score: this.score,
        balance: this.balance,
        netProfit: this.netProfit,
        isPaused: this.isPaused
      });
    }
  }

  public togglePause() {
    this.isPaused = !this.isPaused;
    this.updateGameState();
  }

  public reset() {
    this.score = 0;
    this.balance = 100; // Reset with 100 free DEBRIS tokens
    this.netProfit = 0;
    this.coinBodies.forEach(c => this.world.removeRigidBody(c.body));
    this.coinBodies = [];
    const dummy = new THREE.Object3D();
    dummy.scale.set(0, 0, 0);
    dummy.updateMatrix();
    for (let i = 0; i < PHYSICS.MAX_COINS; i++) {
      this.coinInstancedMesh.setMatrixAt(i, dummy.matrix);
    }
    this.coinInstancedMesh.instanceMatrix.needsUpdate = true;

    this.spawnInitialCoins();
    this.updateGameState();
    this.initRain();
  }

  private startLoop() {
    this.lastTime = performance.now();
    this.simulationTime = this.lastTime / 1000;
    this.loop();
  }

  private loop = () => {
    if (this.isDisposed) return;
    this.requestAnimationId = requestAnimationFrame(this.loop);
    if (this.isPaused) return;

    const now = performance.now();
    const dt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    this.frameCount++;
    if (now - this.lastFpsTime >= 1000) {
      if (this.onGameStateUpdate) {
        this.onGameStateUpdate({ fps: this.frameCount });
      }
      this.frameCount = 0;
      this.lastFpsTime = now;
    }

    this.accumulatedTime += dt;
    const maxSubSteps = 5;
    let steps = 0;
    while (this.accumulatedTime >= PHYSICS.TIMESTEP && steps < maxSubSteps) {
      this.simulationTime += PHYSICS.TIMESTEP;
      this.updatePhysicsLogic(this.simulationTime);
      this.world.step();
      this.accumulatedTime -= PHYSICS.TIMESTEP;
      steps++;
    }

    this.syncGraphics();
    this.updateRain(dt);
    this.renderer.render(this.scene, this.camera);
  }

  private updatePhysicsLogic(time: number) {
    // Use time to drive sine wave.
    // Note: time here is wall clock. For pure determinism we'd use accumulated simulation time.
    const pusherZ = -DIMENSIONS.PLAYFIELD_LENGTH / 2 + 2 +
      Math.sin(time * (Math.PI * 2 / PHYSICS.PUSHER_PERIOD)) * PHYSICS.PUSHER_AMPLITUDE;

    this.pusherBody.setNextKinematicTranslation({ x: 0, y: 0.55, z: pusherZ });

    // Collect indices to remove AFTER reading all positions (avoids RAPIER aliasing)
    const coinRemovals: { index: number; isWin: boolean }[] = [];
    for (let i = this.coinBodies.length - 1; i >= 0; i--) {
      const { y, z } = this.coinBodies[i].body.translation();
      if (y < -2) {
        coinRemovals.push({ index: i, isWin: z > DIMENSIONS.PLAYFIELD_LENGTH / 2 });
      }
    }
    for (const { index, isWin } of coinRemovals) {
      if (isWin) this.handleWin();
      this.world.removeRigidBody(this.coinBodies[index].body);
      this.coinBodies.splice(index, 1);
    }

    if (GameEngine.DEBUG_AUTOPLAY && Math.random() < 0.05) {
      this.dropUserCoin((Math.random() - 0.5) * 6);
    }
  }

  private handleWin() {
    this.score += 1;
    this.balance += 1;
    this.netProfit += 1;

    // Play collection sound
    soundManager.play('coin_collect');

    const now = performance.now();
    if (now - this.lastCollectionTime > 5000) {
      this.coinsCollectedRecently = 0;
    }
    this.coinsCollectedRecently++;
    this.lastCollectionTime = now;

    if (this.coinsCollectedRecently >= 10) {
      this.balance += 5;
      this.netProfit += 5;
      this.coinsCollectedRecently = 0;
      // Play win streak sound
      soundManager.play('win_streak');
    }
    this.updateGameState();
  }

  private syncGraphics() {
    const d = this.dummy;

    // Destructure immediately to release RAPIER WASM borrows before next call
    const { x: px, y: py, z: pz } = this.pusherBody.translation();
    const pusherMesh = (this.pusherBody as any).mesh;
    if (pusherMesh) {
      pusherMesh.position.set(px, py, pz);
    }

    for (let i = 0; i < PHYSICS.MAX_COINS; i++) {
      if (i < this.coinBodies.length) {
        const body = this.coinBodies[i].body;
        const { x: bx, y: by, z: bz } = body.translation();
        const { x: rx, y: ry, z: rz, w: rw } = body.rotation();
        d.position.set(bx, by, bz);
        d.quaternion.set(rx, ry, rz, rw);
        d.scale.set(1, 1, 1);
      } else {
        d.scale.set(0, 0, 0);
      }
      d.updateMatrix();
      this.coinInstancedMesh.setMatrixAt(i, d.matrix);
    }
    this.coinInstancedMesh.instanceMatrix.needsUpdate = true;
  }

  public resize(width: number, height: number) {
    if (this.camera && this.renderer) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    }
  }

  // ─── Rain Effect (event-based, visual rendering in RainOverlay) ──────

  public setRainCallback(cb: (raining: boolean) => void) {
    this.onRainChange = cb;
  }

  private initRain() {
    // Timer is already initialized in field declaration
  }

  private updateRain(dt: number) {
    this.rainTimer += dt;

    if (this.rainTimer >= this.nextRainEvent) {
      this.rainTimer = 0;
      this._isRaining = !this._isRaining;

      if (this._isRaining) {
        this.nextRainEvent = 15 + Math.random() * 30; // rain lasts 15-45s
        soundManager.play('rain_start');
      } else {
        this.nextRainEvent = 45 + Math.random() * 75; // next rain in 45-120s
        soundManager.play('rain_stop');
      }

      this.onRainChange?.(this._isRaining);
    }
  }

  public cleanup() {
    this.isDisposed = true;
    if (this.requestAnimationId) {
      cancelAnimationFrame(this.requestAnimationId);
    }
    if (this._isRaining) {
      soundManager.play('rain_stop');
    }
    this.renderer?.dispose();
    this.world?.free();
  }
}
