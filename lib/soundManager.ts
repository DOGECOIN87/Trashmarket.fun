/**
 * Sound Manager for Junk Pusher Game
 * 
 * Generates arcade-style sound effects using Web Audio API
 * No external audio files needed - all sounds are synthesized
 */

export type SoundType =
  | 'coin_drop'
  | 'coin_land'
  | 'coin_collect'
  | 'trashcoin_collect'
  | 'bump'
  | 'button_click'
  | 'win_streak'
  | 'game_over'
  | 'ui_open'
  | 'ui_close'
  | 'out_of_tokens';

class SoundManager {
  private audioContext: AudioContext | null = null;
  private masterVolume = 0.3;
  private isMuted = false;
  private isInitialized = false;
  private outOfTokensBuffer: AudioBuffer | null = null;

  /**
   * Initialize audio context (must be called after user interaction)
   */
  initialize(): void {
    if (this.isInitialized) return;

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.isInitialized = true;
      this.preloadOutOfTokens();
      console.log('[SoundManager] Initialized');
    } catch (error) {
      console.error('[SoundManager] Failed to initialize:', error);
    }
  }

  /**
   * Play a sound effect
   */
  play(soundType: SoundType): void {
    if (!this.isInitialized || this.isMuted || !this.audioContext) {
      return;
    }

    // Resume audio context if suspended (browser autoplay policy)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    switch (soundType) {
      case 'coin_drop':
        this.playCoinDrop();
        break;
      case 'coin_land':
        this.playCoinLand();
        break;
      case 'coin_collect':
        this.playCoinCollect();
        break;
      case 'trashcoin_collect':
        this.playTrashcoinCollect();
        break;
      case 'bump':
        this.playBump();
        break;
      case 'button_click':
        this.playButtonClick();
        break;
      case 'win_streak':
        this.playWinStreak();
        break;
      case 'game_over':
        this.playGameOver();
        break;
      case 'ui_open':
        this.playUIOpen();
        break;
      case 'ui_close':
        this.playUIClose();
        break;
      case 'out_of_tokens':
        this.playOutOfTokens();
        break;
    }
  }

  /**
   * Coin drop sound - metallic clink
   */
  private playCoinDrop(): void {
    if (!this.audioContext) return;

    const now = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);

    gain.gain.setValueAtTime(this.masterVolume * 0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  /**
   * Coin landing sound - thud with metallic ring
   */
  private playCoinLand(): void {
    if (!this.audioContext) return;

    const now = this.audioContext.currentTime;
    
    // Thud component
    const noise = this.audioContext.createBufferSource();
    const noiseBuffer = this.audioContext.createBuffer(1, 4410, 44100);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    noise.buffer = noiseBuffer;

    const noiseFilter = this.audioContext.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 200;

    const noiseGain = this.audioContext.createGain();
    noiseGain.gain.setValueAtTime(this.masterVolume * 0.2, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.audioContext.destination);

    noise.start(now);
    noise.stop(now + 0.05);

    // Metallic ring
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.15);

    gain.gain.setValueAtTime(this.masterVolume * 0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  /**
   * Coin collect sound - positive chime
   */
  private playCoinCollect(): void {
    if (!this.audioContext) return;

    const now = this.audioContext.currentTime;
    const osc1 = this.audioContext.createOscillator();
    const osc2 = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now); // C5
    
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, now); // E5

    gain.gain.setValueAtTime(this.masterVolume * 0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.audioContext.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.3);
    osc2.stop(now + 0.3);
  }

  /**
   * Trashcoin collect sound - special rare item sound
   */
  private playTrashcoinCollect(): void {
    if (!this.audioContext) return;

    const now = this.audioContext.currentTime;
    const frequencies = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

    frequencies.forEach((freq, i) => {
      const osc = this.audioContext!.createOscillator();
      const gain = this.audioContext!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);

      gain.gain.setValueAtTime(0, now + i * 0.08);
      gain.gain.linearRampToValueAtTime(this.masterVolume * 0.3, now + i * 0.08 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.4);

      osc.connect(gain);
      gain.connect(this.audioContext!.destination);

      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.4);
    });
  }

  /**
   * Bump sound - mechanical thump
   */
  private playBump(): void {
    if (!this.audioContext) return;

    const now = this.audioContext.currentTime;

    // Low frequency thump
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);

    gain.gain.setValueAtTime(this.masterVolume * 0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    osc.start(now);
    osc.stop(now + 0.2);

    // Mechanical clank
    const noise = this.audioContext.createBufferSource();
    const noiseBuffer = this.audioContext.createBuffer(1, 2205, 44100);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    noise.buffer = noiseBuffer;

    const noiseGain = this.audioContext.createGain();
    noiseGain.gain.setValueAtTime(this.masterVolume * 0.3, now + 0.05);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    noise.connect(noiseGain);
    noiseGain.connect(this.audioContext.destination);

    noise.start(now + 0.05);
  }

  /**
   * Button click sound
   */
  private playButtonClick(): void {
    if (!this.audioContext) return;

    const now = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, now);

    gain.gain.setValueAtTime(this.masterVolume * 0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  /**
   * Win streak sound - ascending arpeggio
   */
  private playWinStreak(): void {
    if (!this.audioContext) return;

    const now = this.audioContext.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5

    notes.forEach((freq, i) => {
      const osc = this.audioContext!.createOscillator();
      const gain = this.audioContext!.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, now + i * 0.1);

      gain.gain.setValueAtTime(this.masterVolume * 0.25, now + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.2);

      osc.connect(gain);
      gain.connect(this.audioContext!.destination);

      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.2);
    });
  }

  /**
   * Game over sound - descending tone
   */
  private playGameOver(): void {
    if (!this.audioContext) return;

    const now = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.8);

    gain.gain.setValueAtTime(this.masterVolume * 0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    osc.start(now);
    osc.stop(now + 0.8);
  }

  /**
   * UI open sound
   */
  private playUIOpen(): void {
    if (!this.audioContext) return;

    const now = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.linearRampToValueAtTime(800, now + 0.1);

    gain.gain.setValueAtTime(this.masterVolume * 0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  /**
   * UI close sound
   */
  private playUIClose(): void {
    if (!this.audioContext) return;

    const now = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.linearRampToValueAtTime(600, now + 0.1);

    gain.gain.setValueAtTime(this.masterVolume * 0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  private preloadOutOfTokens(): void {
    if (!this.audioContext) return;
    fetch('/fawwwwwwwk.mp3')
      .then(res => res.arrayBuffer())
      .then(buf => this.audioContext!.decodeAudioData(buf))
      .then(decoded => { this.outOfTokensBuffer = decoded; })
      .catch(err => console.warn('[SoundManager] Failed to load out_of_tokens sound:', err));
  }

  private playOutOfTokens(): void {
    if (!this.audioContext || !this.outOfTokensBuffer) return;

    const source = this.audioContext.createBufferSource();
    source.buffer = this.outOfTokensBuffer;

    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(this.masterVolume, this.audioContext.currentTime);

    source.connect(gain);
    gain.connect(this.audioContext.destination);
    source.start();
  }

  /**
   * Set master volume (0.0 to 1.0)
   */
  setVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
  }

  /**
   * Toggle mute
   */
  toggleMute(): void {
    this.isMuted = !this.isMuted;
  }

  /**
   * Get mute state
   */
  isMutedState(): boolean {
    return this.isMuted;
  }

  /**
   * Cleanup
   */
  dispose(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
      this.isInitialized = false;
    }
  }
}

// Export singleton instance
export const soundManager = new SoundManager();

export default soundManager;
