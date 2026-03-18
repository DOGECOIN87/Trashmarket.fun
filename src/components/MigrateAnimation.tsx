import React, { useEffect, useRef, useState, useCallback } from 'react';

/* ─── Brand Tokens ─── */
const C = {
  green: '#adff02',
  magenta: '#ff00ff',
  purple: '#9945ff',
  red: '#ff2222',
  white: '#FFFFFF',
  black: '#000000',
  card: '#080808',
  cardBorder: '#1a1a1a',
  glowGreen: '#00ff00',
  glowCyan: '#00ffff',
  muted: '#666666',
  orange: '#ff8800',
};

const FONT = "'JetBrains Mono', monospace";

/* ─── Math helpers ─── */
function clampVal(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function interpolate(
  value: number,
  inputRange: number[],
  outputRange: number[],
): number {
  const v = clampVal(value, inputRange[0], inputRange[inputRange.length - 1]);
  for (let i = 0; i < inputRange.length - 1; i++) {
    if (v >= inputRange[i] && v <= inputRange[i + 1]) {
      const t = (v - inputRange[i]) / (inputRange[i + 1] - inputRange[i]);
      return outputRange[i] + t * (outputRange[i + 1] - outputRange[i]);
    }
  }
  return outputRange[outputRange.length - 1];
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function easeInCubic(t: number) {
  return t * t * t;
}

/** Simple spring approximation (critically damped) */
function springValue(frame: number, delay: number, stiffness = 200, damping = 14): number {
  const t = Math.max(0, frame - delay) / 30; // normalize to seconds at 30fps
  if (t <= 0) return 0;
  const omega = Math.sqrt(stiffness);
  const zeta = damping / (2 * omega);
  if (zeta >= 1) {
    // Overdamped
    return 1 - Math.exp(-omega * t) * (1 + omega * t);
  }
  const omegaD = omega * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * omega * t) * (Math.cos(omegaD * t) + (zeta * omega / omegaD) * Math.sin(omegaD * t));
}

/* ─── Seeded PRNG for deterministic particles ─── */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/* ─── Particle system ─── */
interface Particle {
  id: number;
  startX: number;
  startY: number;
  chaosX: number;
  chaosY: number;
  chaosRotation: number;
  orbitRadius: number;
  orbitSpeed: number;
  orbitPhase: number;
  endX: number;
  endY: number;
  size: number;
  color: string;
  delay: number;
}

function generateParticles(count: number): Particle[] {
  const rng = seededRandom(42069);
  const colors = [C.green, C.magenta, C.purple, C.glowCyan, C.white, C.orange];
  const particles: Particle[] = [];
  const CARD_W = 280;
  const CARD_H = 370;

  for (let i = 0; i < count; i++) {
    const gridX = (i % 14) / 14;
    const gridY = Math.floor(i / 14) / Math.ceil(count / 14);
    particles.push({
      id: i,
      startX: (gridX - 0.5) * CARD_W + (rng() - 0.5) * 18,
      startY: (gridY - 0.5) * CARD_H + (rng() - 0.5) * 18,
      chaosX: (rng() - 0.5) * 700,
      chaosY: (rng() - 0.5) * 500,
      chaosRotation: (rng() - 0.5) * 720,
      orbitRadius: 60 + rng() * 160,
      orbitSpeed: 0.03 + rng() * 0.05,
      orbitPhase: rng() * Math.PI * 2,
      endX: (gridX - 0.5) * CARD_W + (rng() - 0.5) * 18,
      endY: (gridY - 0.5) * CARD_H + (rng() - 0.5) * 18,
      size: 2 + rng() * 4,
      color: colors[Math.floor(rng() * colors.length)],
      delay: rng() * 12,
    });
  }
  return particles;
}

const PARTICLES = generateParticles(150);

/* ─── Timeline (frames @30fps, 10s = 300 frames) ─── */
const T = {
  cardIn: 0,
  cardStable: 55,
  glitchStart: 55,
  glitchPeak: 100,
  disintStart: 95,
  disintEnd: 155,
  vortexStart: 140,
  vortexEnd: 200,
  reformStart: 195,
  reformEnd: 250,
  celebStart: 245,
  celebEnd: 300,
};

/* ─── Component Props ─── */
interface MigrateAnimationProps {
  /** URL of the NFT image */
  imageUrl?: string;
  /** NFT display name */
  nftName: string;
  /** Truncated mint address for display */
  nftMint: string;
  /** Called when animation finishes */
  onComplete?: () => void;
  /** Called when user clicks dismiss */
  onDismiss?: () => void;
}

/* ─── NFT Card Sub-component ─── */
const NFTCardVisual: React.FC<{
  imageUrl?: string;
  nftName: string;
  nftMint: string;
  badge: 'LEGACY' | 'MIGRATED';
  badgeColor: string;
  glowColor: string;
  glowSize: number;
  glitchIntensity: number;
  frame: number;
}> = ({ imageUrl, nftName, nftMint, badge, badgeColor, glowColor, glowSize, glitchIntensity, frame }) => {
  const splitX = glitchIntensity * Math.sin(frame * 13.7) * 4;
  const splitY = glitchIntensity * Math.cos(frame * 9.3) * 2;

  const cardContent = (colorTint?: string, opacityOverride?: number) => (
    <div
      style={{
        width: 280,
        height: 370,
        border: `1px solid ${C.cardBorder}`,
        overflow: 'hidden',
        position: 'relative',
        fontFamily: FONT,
        backgroundColor: `${C.card}ee`,
        opacity: opacityOverride ?? 1,
        boxShadow: glowSize > 0 ? `0 0 ${glowSize}px ${glowColor}, 0 0 ${glowSize * 2}px ${glowColor}40` : 'none',
      }}
    >
      {/* NFT Image / Placeholder */}
      <div style={{ width: '100%', height: 240, position: 'relative', overflow: 'hidden', backgroundColor: '#111' }}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={nftName}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <svg width={280} height={240} viewBox="0 0 280 240">
            {Array.from({ length: 7 }).map((_, row) =>
              Array.from({ length: 7 }).map((_, col) => {
                const rng = seededRandom(row * 7 + col + 777);
                const g = 40 + Math.floor(rng() * 80);
                const b = 20 + Math.floor(rng() * 40);
                return (
                  <rect key={`${row}-${col}`} x={col * 40} y={row * 35} width={40} height={35}
                    fill={`rgb(${b}, ${g}, ${b * 0.5})`} opacity={0.8 + rng() * 0.2} />
                );
              })
            )}
            <ellipse cx={140} cy={100} rx={60} ry={75} fill="#2a4a1a" opacity={0.6} />
            <ellipse cx={140} cy={70} rx={42} ry={45} fill="#3a5a2a" opacity={0.5} />
            <circle cx={122} cy={82} r={7} fill="#111" />
            <circle cx={158} cy={82} r={7} fill="#111" />
            <circle cx={124} cy={80} r={2.5} fill={C.white} />
            <circle cx={160} cy={80} r={2.5} fill={C.white} />
          </svg>
        )}

        {/* Scan lines during glitch */}
        {glitchIntensity > 0 && (
          <div style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            background: `repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,${glitchIntensity * 0.3}) 2px, rgba(0,0,0,${glitchIntensity * 0.3}) 4px)`,
          }} />
        )}

        {/* Color tint overlay for ghost layers */}
        {colorTint && (
          <div style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: colorTint, mixBlendMode: 'multiply', opacity: 0.3,
          }} />
        )}
      </div>

      {/* Card info */}
      <div style={{ padding: '12px 14px' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.white, textTransform: 'uppercase' }}>
          {nftName}
        </div>
        <div style={{ fontSize: 10, color: C.muted, marginTop: 3, letterSpacing: '0.05em' }}>
          {nftMint}
        </div>
        <div style={{
          display: 'inline-block', marginTop: 10, padding: '3px 10px',
          fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
          color: C.black, backgroundColor: badgeColor, textTransform: 'uppercase',
        }}>
          {badge}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ position: 'relative' }}>
      {/* RGB ghost layers during glitch */}
      {glitchIntensity > 0.1 && (
        <>
          <div style={{
            position: 'absolute', top: splitY - 2, left: splitX - 3,
            clipPath: `inset(${(frame * 41) % 50}% 0 ${(frame * 31) % 40}% 0)`,
          }}>
            {cardContent(C.red, glitchIntensity * 0.4)}
          </div>
          <div style={{
            position: 'absolute', top: -splitY + 1, left: -splitX + 3,
            clipPath: `inset(${(frame * 29) % 35}% 0 ${(frame * 53) % 45}% 0)`,
          }}>
            {cardContent(C.glowGreen, glitchIntensity * 0.3)}
          </div>
        </>
      )}
      {cardContent()}
    </div>
  );
};

/* ─── Main Animation Component ─── */
const MigrateAnimation: React.FC<MigrateAnimationProps> = ({
  imageUrl,
  nftName,
  nftMint,
  onComplete,
  onDismiss,
}) => {
  const [frame, setFrame] = useState(0);
  const [finished, setFinished] = useState(false);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  // Store callbacks in refs to avoid re-triggering the animation loop
  const onCompleteRef = useRef(onComplete);
  const onDismissRef = useRef(onDismiss);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { onDismissRef.current = onDismiss; }, [onDismiss]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(960);

  // Measure container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Responsive layout values
  const scale = Math.min(1, containerWidth / 960);
  const CARD_LEFT_X = -280 * scale;
  const CARD_RIGHT_X = 280 * scale;
  const centerX = containerWidth / 2;
  const centerY = 260;

  // Animation loop at 30fps — stable, no dependency on callbacks
  useEffect(() => {
    startTimeRef.current = 0;
    setFrame(0);
    setFinished(false);

    const tick = () => {
      const now = performance.now();
      if (!startTimeRef.current) startTimeRef.current = now;
      const elapsed = now - startTimeRef.current;
      const f = Math.floor(elapsed / (1000 / 30));
      setFrame(f);

      if (f >= T.celebEnd) {
        setFinished(true);
        onCompleteRef.current?.();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []); // stable — runs once on mount

  /* ── Phase calculations ── */
  const cardEnterSpring = springValue(frame, 5, 200, 14);
  const cardEnterOpacity = interpolate(frame, [5, 20], [0, 1]);

  const glitchRamp = interpolate(frame, [T.glitchStart, T.glitchPeak], [0, 1]);
  const shakeIntensity = glitchRamp * 10 * scale;
  const shakeX = shakeIntensity * Math.sin(frame * 17.3);
  const shakeY = shakeIntensity * Math.cos(frame * 23.1);

  const cardDisintOpacity = interpolate(frame, [T.disintStart, T.disintStart + 25], [1, 0]);
  const legacyVisible = frame < T.disintStart + 25;
  const legacyOpacity = legacyVisible ? cardEnterOpacity * cardDisintOpacity : 0;
  const legacyScale = legacyVisible ? cardEnterSpring : 0;

  const vortexProgress = interpolate(frame, [T.vortexStart, T.vortexEnd], [0, 1]);
  const vortexRingOpacity = interpolate(
    frame,
    [T.vortexStart - 10, T.vortexStart + 10, T.vortexEnd - 10, T.vortexEnd + 15],
    [0, 1, 1, 0],
  );
  const vortexRingScale = springValue(Math.max(0, frame - T.vortexStart + 10), 0, 150, 15);

  const newCardOpacity = interpolate(frame, [T.reformEnd - 20, T.reformEnd], [0, 1]);
  const newCardScale = springValue(Math.max(0, frame - (T.reformEnd - 20)), 0, 200, 12);

  const celebGlow = interpolate(frame, [T.celebStart, T.celebStart + 15, T.celebEnd], [0, 50, 15]);

  // Status text
  const statusInitiating = interpolate(frame, [T.glitchStart, T.glitchStart + 12, T.disintStart, T.disintStart + 10], [0, 1, 1, 0]);
  const statusBurning = interpolate(frame, [T.disintStart + 5, T.disintStart + 15, T.vortexEnd - 15, T.vortexEnd], [0, 1, 1, 0]);
  const statusMinting = interpolate(frame, [T.reformStart, T.reformStart + 12, T.reformEnd - 5, T.reformEnd + 5], [0, 1, 1, 0]);
  const statusComplete = interpolate(frame, [T.celebStart + 5, T.celebStart + 18], [0, 1]);

  // Progress bar
  const overallProgress = interpolate(frame, [T.glitchStart, T.celebStart + 20], [0, 100]);
  const progressBarOpacity = interpolate(
    frame,
    [T.glitchStart - 5, T.glitchStart + 5, T.celebStart + 25, T.celebEnd],
    [0, 1, 1, 0],
  );

  /* ── Particles ── */
  const renderParticles = () => {
    if (frame < T.disintStart - 5 || frame > T.reformEnd + 20) return null;

    return PARTICLES.map((p) => {
      const particleFrame = frame - p.delay * 0.5;
      const particleOpacity = interpolate(
        frame,
        [T.disintStart + p.delay, T.disintStart + p.delay + 8, T.reformEnd - 5, T.reformEnd + 15],
        [0, 0.9, 0.9, 0],
      );
      if (particleOpacity < 0.01) return null;

      const chaosT = easeOutCubic(
        clampVal((frame - T.disintStart - p.delay) / (T.disintEnd - T.disintStart + p.delay * 0.3), 0, 1),
      );
      const vortexT = interpolate(frame, [T.vortexStart, T.vortexEnd], [0, 1]);
      const reformT = easeInCubic(
        clampVal((frame - T.reformStart - p.delay * 0.3) / (T.reformEnd - T.reformStart), 0, 1),
      );

      let x: number, y: number;

      if (reformT > 0.01) {
        const orbitAngle = p.orbitPhase + particleFrame * p.orbitSpeed;
        const orbitX = Math.cos(orbitAngle) * p.orbitRadius * (1 - reformT) * scale;
        const orbitY = Math.sin(orbitAngle) * p.orbitRadius * (1 - reformT) * scale;
        const targetX = CARD_RIGHT_X + p.endX * scale;
        const targetY = p.endY * scale;
        x = orbitX + (targetX - orbitX) * reformT;
        y = orbitY + (targetY - orbitY) * reformT;
      } else if (vortexT > 0.01) {
        const orbitAngle = p.orbitPhase + particleFrame * p.orbitSpeed;
        const shrink = interpolate(vortexT, [0, 1], [1, 0.4]);
        x = Math.cos(orbitAngle) * p.orbitRadius * shrink * scale;
        y = Math.sin(orbitAngle) * p.orbitRadius * shrink * scale;
      } else {
        const startX = CARD_LEFT_X + p.startX * scale;
        const startY = p.startY * scale;
        x = startX + p.chaosX * chaosT * scale;
        y = startY + p.chaosY * chaosT * scale;
      }

      const particleGlow = p.size * 2 + (vortexT > 0.5 ? 4 : 0);

      return (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: centerX + x - p.size / 2,
            top: centerY + y - p.size / 2,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            opacity: particleOpacity,
            borderRadius: p.size < 3 ? '50%' : 0,
            boxShadow: `0 0 ${particleGlow}px ${p.color}`,
            transform: `rotate(${p.chaosRotation * chaosT * (1 - reformT)}deg)`,
            willChange: 'transform, opacity',
          }}
        />
      );
    });
  };

  /* ── Celebration sparkles ── */
  const renderSparkles = () => {
    if (frame < T.celebStart) return null;
    const rng = seededRandom(12345);
    return Array.from({ length: 20 }).map((_, i) => {
      const angle = (i / 20) * Math.PI * 2 + rng() * 0.5;
      const dist = 60 + rng() * 200;
      const sparkleFrame = frame - T.celebStart - rng() * 10;
      const sparkleProgress = interpolate(sparkleFrame, [0, 20], [0, 1]);
      const sparkleOpacity = interpolate(sparkleFrame, [0, 8, 15, 25], [0, 1, 1, 0]);
      const sx = CARD_RIGHT_X + Math.cos(angle) * dist * sparkleProgress * scale;
      const sy = Math.sin(angle) * dist * sparkleProgress * scale;
      const sparkleSize = 2 + rng() * 3;
      const sparkleColor = [C.green, C.magenta, C.glowCyan, C.white][Math.floor(rng() * 4)];

      return (
        <div
          key={`s${i}`}
          style={{
            position: 'absolute',
            left: centerX + sx,
            top: centerY + sy,
            width: sparkleSize,
            height: sparkleSize,
            backgroundColor: sparkleColor,
            opacity: sparkleOpacity,
            borderRadius: '50%',
            boxShadow: `0 0 ${sparkleSize * 3}px ${sparkleColor}`,
          }}
        />
      );
    });
  };

  /* ── Burn vault ring ── */
  const renderBurnVault = () => {
    if (vortexRingOpacity < 0.02) return null;
    const pulse = 0.8 + Math.sin(frame * 0.15) * 0.2;
    const ringGlow = 20 + Math.sin(frame * 0.1) * 15;
    const ringScale = vortexRingScale * pulse * scale;

    return (
      <div
        style={{
          position: 'absolute',
          left: centerX - 120 * scale,
          top: centerY - 120 * scale,
          opacity: vortexRingOpacity,
          transform: `scale(${ringScale})`,
          transformOrigin: 'center',
          width: 240 * scale,
          height: 240 * scale,
        }}
      >
        <svg width="100%" height="100%" viewBox="-120 -120 240 240">
          <defs>
            <radialGradient id="vaultGlow">
              <stop offset="0%" stopColor={C.red} stopOpacity={0.15} />
              <stop offset="60%" stopColor={C.orange} stopOpacity={0.05} />
              <stop offset="100%" stopColor="transparent" stopOpacity={0} />
            </radialGradient>
          </defs>
          <circle cx={0} cy={0} r={100} fill="none" stroke={C.red} strokeWidth={2.5} opacity={0.3}
            filter={`drop-shadow(0 0 ${ringGlow}px ${C.red})`} />
          <circle cx={0} cy={0} r={80} fill="none" stroke={C.orange} strokeWidth={2} opacity={0.8}
            strokeDasharray="15 8" strokeDashoffset={frame * 2}
            filter={`drop-shadow(0 0 ${ringGlow * 0.7}px ${C.orange})`} />
          <circle cx={0} cy={0} r={65} fill="none" stroke={C.red} strokeWidth={1.5} opacity={0.5}
            strokeDasharray="6 12" strokeDashoffset={-frame * 3} />
          <circle cx={0} cy={0} r={75} fill="url(#vaultGlow)" />
          <text x={0} y={-108} textAnchor="middle" fontFamily={FONT} fontSize={12}
            fontWeight={700} fill={C.red} letterSpacing="0.2em" opacity={0.8}>
            BURN VAULT
          </text>
        </svg>
      </div>
    );
  };

  /* ── Status text helper ── */
  const statusText = (text: string, color: string, opacity: number, fontSize = 18) => {
    if (opacity < 0.02) return null;
    return (
      <div
        style={{
          position: 'absolute',
          bottom: 80,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: FONT,
          fontSize: fontSize * scale,
          fontWeight: 700,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color,
          opacity,
          textShadow: `0 0 10px ${color}, 0 0 20px ${color}50`,
        }}
      >
        {text}
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: 580,
        overflow: 'hidden',
        backgroundColor: 'transparent',
      }}
    >
      {/* Connecting beam between card positions */}
      {vortexRingOpacity > 0.05 && (
        <div
          style={{
            position: 'absolute',
            top: centerY - 1,
            left: centerX + CARD_LEFT_X,
            width: CARD_RIGHT_X - CARD_LEFT_X,
            height: 2,
            background: `linear-gradient(to right, ${C.red}00, ${C.red}60, ${C.green}60, ${C.green}00)`,
            opacity: vortexRingOpacity * 0.4,
            boxShadow: `0 0 10px ${C.red}40`,
          }}
        />
      )}

      {/* Legacy card (left) */}
      <div
        style={{
          position: 'absolute',
          left: centerX + CARD_LEFT_X - 140 * scale,
          top: centerY - 185 * scale,
          opacity: legacyOpacity,
          transform: `scale(${legacyScale * scale}) translate(${shakeX}px, ${shakeY}px)`,
          transformOrigin: 'center',
        }}
      >
        <NFTCardVisual
          imageUrl={imageUrl}
          nftName={nftName}
          nftMint={nftMint}
          badge="LEGACY"
          badgeColor={C.orange}
          glowColor={C.red}
          glowSize={glitchRamp * 25}
          glitchIntensity={glitchRamp}
          frame={frame}
        />
      </div>

      {/* Burn vault ring (center) */}
      {renderBurnVault()}

      {/* Particles */}
      {renderParticles()}

      {/* Migrated card (right) */}
      <div
        style={{
          position: 'absolute',
          left: centerX + CARD_RIGHT_X - 140 * scale,
          top: centerY - 185 * scale,
          opacity: newCardOpacity,
          transform: `scale(${newCardScale * scale})`,
          transformOrigin: 'center',
        }}
      >
        <NFTCardVisual
          imageUrl={imageUrl}
          nftName={nftName}
          nftMint={nftMint}
          badge="MIGRATED"
          badgeColor={C.green}
          glowColor={C.glowGreen}
          glowSize={celebGlow}
          glitchIntensity={0}
          frame={frame}
        />
      </div>

      {/* Celebration sparkles */}
      {renderSparkles()}

      {/* Flow indicator */}
      {vortexRingOpacity > 0.1 && (
        <div
          style={{
            position: 'absolute',
            bottom: 115,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontFamily: FONT,
            fontSize: 13 * scale,
            fontWeight: 700,
            letterSpacing: '0.3em',
            color: C.muted,
            opacity: vortexRingOpacity * 0.6,
          }}
        >
          <span style={{ color: C.red }}>LEGACY</span>
          {' >>> '}
          <span style={{ color: C.orange }}>BURN</span>
          {' >>> '}
          <span style={{ color: C.green }}>METAPLEX</span>
        </div>
      )}

      {/* Status text phases */}
      {statusText('INITIATING MIGRATION...', C.orange, statusInitiating)}
      {statusText('LOCKING IN BURN VAULT...', C.red, statusBurning)}
      {statusText('MINTING METAPLEX TOKEN...', C.green, statusMinting)}
      {statusText('MIGRATION COMPLETE', C.green, statusComplete, 22)}

      {/* Progress bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 50,
          left: '50%',
          transform: 'translateX(-50%)',
          width: Math.min(400, containerWidth - 60),
          height: 3,
          backgroundColor: `${C.muted}30`,
          opacity: progressBarOpacity,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${overallProgress}%`,
            height: '100%',
            backgroundColor: overallProgress < 40 ? C.orange : overallProgress < 75 ? C.red : C.green,
            boxShadow: `0 0 8px ${overallProgress < 40 ? C.orange : overallProgress < 75 ? C.red : C.glowGreen}`,
          }}
        />
      </div>

      {/* Progress percentage */}
      <div
        style={{
          position: 'absolute',
          bottom: 32,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: FONT,
          fontSize: 11,
          fontWeight: 400,
          letterSpacing: '0.15em',
          color: C.muted,
          opacity: progressBarOpacity,
        }}
      >
        {Math.round(overallProgress)}%
      </div>

      {/* Dismiss button after completion */}
      {finished && (
        <button
          onClick={() => onDismissRef.current?.()}
          style={{
            position: 'absolute',
            bottom: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            fontFamily: FONT,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.15em',
            color: C.green,
            backgroundColor: 'transparent',
            border: `1px solid ${C.green}40`,
            padding: '6px 20px',
            cursor: 'pointer',
            textTransform: 'uppercase',
          }}
        >
          CONTINUE
        </button>
      )}
    </div>
  );
};

export default MigrateAnimation;
