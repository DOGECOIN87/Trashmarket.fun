/**
 * Global Audio Manager for Trashmarket.fun
 * Plays MP3 sound effects for UI events across the dapp.
 * Each sound plays at most once at a time — no overlapping.
 */

const SOUNDS = {
  // DEX
  swap_success: '/audio/kids cheering yayyyy.mp3',
  swap_fail: '/audio/emotional-damage-meme.mp3',
  swap_expired: '/audio/bruh.mp3',
  price_impact_warning: '/audio/no no no wait wait wait meme.mp3',

  // Wallet
  wallet_connect: '/audio/among-us-role-reveal-sound.mp3',
  wallet_disconnect: '/audio/sad-meow-song.mp3',

  // Page loads
  page_dex: '/audio/run-vine.mp3',
  page_gorbagio: '/audio/western music.mp3',
  page_raffle: '/audio/dun-dun-dunnnnnnnn.mp3',
  page_bridge: '/audio/metal-gear-solid-alert.mp3',
  page_gorid: '/audio/door-knocking-sound-effect.mp3',
  page_vanity: '/audio/rizz-sound-effect.mp3',

  // Raffle
  raffle_win: '/audio/heavenly-musiic.mp3',
  raffle_lose: '/audio/death bell meme.mp3',

  // Marketplace
  purchase_success: '/audio/anime-wow.mp3',
  list_success: '/audio/core-sound-effect.mp3',

  // Notifications
  error: '/audio/spongebob-fail.mp3',
} as const;

export type SoundName = keyof typeof SOUNDS;

class AudioManager {
  private cache: Map<string, HTMLAudioElement> = new Map();
  private muted = false;
  private volume = 0.4;
  private currentlyPlaying: HTMLAudioElement | null = null;

  /** Play a named sound effect. Stops any currently playing sound first. */
  play(name: SoundName): void {
    if (this.muted) return;
    const src = SOUNDS[name];
    if (!src) return;

    // Stop any currently playing sound to prevent overlap
    if (this.currentlyPlaying && !this.currentlyPlaying.paused) {
      this.currentlyPlaying.pause();
      this.currentlyPlaying.currentTime = 0;
    }

    let audio = this.cache.get(name);
    if (!audio) {
      audio = new Audio(src);
      this.cache.set(name, audio);
    }

    audio.volume = this.volume;
    audio.currentTime = 0;
    audio.play().catch(() => {});
    this.currentlyPlaying = audio;
  }

  /** Play on first user interaction if autoplay is blocked. Plays only once. */
  playOnInteraction(name: SoundName): () => void {
    if (this.muted) return () => {};

    let played = false;

    const tryPlay = () => {
      if (played) return;
      played = true;
      this.play(name);
      cleanup();
    };

    const cleanup = () => {
      document.removeEventListener('click', tryPlay);
      document.removeEventListener('keydown', tryPlay);
    };

    // Try immediately, fall back to first interaction
    const src = SOUNDS[name];
    const audio = new Audio(src);
    audio.volume = this.volume;
    audio.play().then(() => {
      played = true;
      this.cache.set(name, audio);
      this.currentlyPlaying = audio;
      cleanup();
    }).catch(() => {
      document.addEventListener('click', tryPlay, { once: true });
      document.addEventListener('keydown', tryPlay, { once: true });
    });

    return () => {
      played = true;
      audio.pause();
      audio.src = '';
      cleanup();
    };
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.muted && this.currentlyPlaying) {
      this.currentlyPlaying.pause();
    }
    return this.muted;
  }

  isMuted(): boolean {
    return this.muted;
  }
}

export const audioManager = new AudioManager();
export default audioManager;
