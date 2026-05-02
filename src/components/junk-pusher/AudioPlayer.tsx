import React, { useState, useEffect, useRef, useCallback } from 'react';

const API_KEY = '545aaa48076fa070f9c312a294558e18613c1f5b';
const BEARER_TOKEN = 'iE4Lsu39D7f5RuCoXP_6KrTftUAqV_gAvsAxk4CbpEo=';
const APP_NAME = 'TRASHMARKET_FUN';
// Always proxy via /audius-api — Vite handles this in dev, Cloudflare Pages Function in prod.
const API_BASE = '/audius-api';

interface AudiusTrack {
  id: string;
  title: string;
  user: { name: string };
  artwork: { '150x150'?: string; '480x480'?: string; '1000x1000'?: string } | null;
  duration: number;
  stream?: { url?: string } | null;
}

async function fetchTracks(): Promise<AudiusTrack[]> {
  try {
    const res = await fetch(
      `${API_BASE}/v1/tracks/trending?app_name=${APP_NAME}&limit=30`,
      { headers: { 'X-API-KEY': API_KEY, 'Authorization': `Bearer ${BEARER_TOKEN}` } }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.data ?? [];
  } catch (e) {
    console.warn('[AudiusPlayer] Failed to fetch tracks:', e);
    return [];
  }
}

const AudioPlayer: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  // shouldPlayRef = user intent: true means "play when ready", false means "stay paused"
  const shouldPlayRef = useRef(false);

  const [tracks, setTracks] = useState<AudiusTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [volume, setVolume] = useState(0.4);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  // Keep a ref to tracks so audio event callbacks don't go stale
  const tracksRef = useRef<AudiusTrack[]>([]);
  tracksRef.current = tracks;

  useEffect(() => {
    fetchTracks().then(setTracks);
  }, []);

  // Wire audio events once — use refs so closures never go stale
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      setProgress(audio.duration ? audio.currentTime / audio.duration : 0);
    };
    const onDurationChange = () => setTotalDuration(isFinite(audio.duration) ? audio.duration : 0);
    const onEnded = () => {
      shouldPlayRef.current = true;
      const len = tracksRef.current.length;
      if (len > 0) setCurrentIndex(i => (i + 1) % len);
    };
    const onPlay = () => { setIsPlaying(true); setIsBuffering(false); };
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setIsBuffering(true);
    const onCanPlay = () => setIsBuffering(false);
    const onError = () => {
      const err = audio.error;
      if (err && err.code !== MediaError.MEDIA_ERR_ABORTED) {
        console.warn('[AudiusPlayer] media error', err.code, err.message);
        setIsPlaying(false);
        setIsBuffering(false);
      }
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('canplay', onCanPlay);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('canplay', onCanPlay);
    };
  }, []); // mount only — tracksRef keeps callbacks fresh

  // Load track when index or tracks array changes
  useEffect(() => {
    const audio = audioRef.current;
    const track = tracks[currentIndex];
    if (!audio || !track) return;

    // Always use the proxy path as audio.src so it appears same-origin to the browser.
    // In dev: Vite proxies /audius-api → api.audius.co and follows the CDN redirect.
    // In prod: direct to api.audius.co (no extension CSP interference on deployed site).
    const url = `${API_BASE}/v1/tracks/${track.id}/stream?app_name=${APP_NAME}`;
    setProgress(0); setCurrentTime(0); setTotalDuration(0); setIsBuffering(false);
    audio.src = url;
    audio.volume = volume;
    audio.muted = isMuted;
    if (shouldPlayRef.current) {
      audio.play().catch(e => console.warn('[AudiusPlayer] play failed:', e));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, tracks]);

  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      shouldPlayRef.current = true;
      audio.play().catch(e => console.warn('[AudiusPlayer] play failed:', e));
    } else {
      shouldPlayRef.current = false;
      audio.pause();
    }
  }, []);

  const handleNext = useCallback(() => {
    const len = tracksRef.current.length;
    if (len > 0) setCurrentIndex(i => (i + 1) % len);
  }, []);

  const handlePrev = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) { audio.currentTime = 0; return; }
    const len = tracksRef.current.length;
    if (len > 0) setCurrentIndex(i => (i - 1 + len) % len);
  }, []);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio || !totalDuration) return;
    audio.currentTime = parseFloat(e.target.value) * totalDuration;
  };

  const handleVolumeChange = (v: number) => {
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
    if (v > 0) { setIsMuted(false); if (audioRef.current) audioRef.current.muted = false; }
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    if (audioRef.current) audioRef.current.muted = next;
  };

  const fmt = (s: number) => {
    if (!s || !isFinite(s)) return '0:00';
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };

  const currentTrack = tracks[currentIndex] ?? null;
  const artwork = currentTrack?.artwork?.['150x150'] || currentTrack?.artwork?.['480x480'] || null;
  const trackTitle = tracks.length === 0 ? 'Loading…' : (currentTrack?.title ?? '—');
  const artistName = currentTrack?.user?.name ?? '';

  const glass: React.CSSProperties = {
    background: 'linear-gradient(135deg, rgba(6,6,3,0.92) 0%, rgba(14,16,6,0.92) 100%)',
    border: `1px solid ${isPlaying ? 'rgba(203,243,12,0.3)' : 'rgba(203,243,12,0.1)'}`,
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    boxShadow: isPlaying
      ? '0 0 24px rgba(203,243,12,0.1), 0 4px 24px rgba(0,0,0,0.6)'
      : '0 4px 20px rgba(0,0,0,0.55)',
    transition: 'border-color 0.4s, box-shadow 0.4s',
  };

  return (
    <div className="pointer-events-auto select-none shrink-0">
      <audio ref={audioRef} preload="none" />

      {/* ─── COLLAPSED ─── */}
      {!isExpanded && (
        <div
          className="flex items-center gap-2 rounded-xl cursor-pointer"
          style={{ ...glass, padding: '6px 10px 6px 6px', minWidth: 0 }}
          onClick={() => setIsExpanded(true)}
        >
          <div
            className="relative flex-shrink-0 rounded-lg overflow-hidden"
            style={{
              width: 38, height: 38,
              border: `1.5px solid ${isPlaying ? 'rgba(203,243,12,0.4)' : 'rgba(255,255,255,0.08)'}`,
              animation: isPlaying ? 'tm-art-pulse 3s ease-in-out infinite' : 'none',
            }}
          >
            {artwork ? <img src={artwork} className="w-full h-full object-cover" alt="" /> : <ArtPlaceholder />}
          </div>
          <div className="flex flex-col min-w-0 flex-1" style={{ maxWidth: 110 }}>
            <span className="text-white/85 text-[10px] font-semibold leading-tight truncate">{trackTitle}</span>
            <span className="text-[#cbf30c]/45 text-[9px] truncate mt-0.5">{artistName}</span>
          </div>
          <button
            onClick={e => { e.stopPropagation(); handlePlayPause(); }}
            className="flex-shrink-0 rounded-full flex items-center justify-center transition-all active:scale-90"
            style={{ width: 28, height: 28, background: 'rgba(203,243,12,0.15)', border: '1px solid rgba(203,243,12,0.25)', color: '#cbf30c' }}
          >
            {isBuffering ? <Spinner size={12} /> : isPlaying ? <Pause size={11} /> : <Play size={11} offset />}
          </button>
        </div>
      )}

      {/* ─── EXPANDED ─── */}
      {isExpanded && (
        <div className="rounded-2xl overflow-hidden" style={{ ...glass, width: 'clamp(220px, 45vw, 256px)' }}>
          <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
            <div className="flex items-center gap-1.5">
              <AudiusLogo />
              <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: '#CC147F' }}>Audius</span>
              {tracks.length > 0 && (
                <span className="text-white/15 text-[8px] font-mono ml-0.5">{currentIndex + 1}/{tracks.length}</span>
              )}
            </div>
            <button onClick={() => setIsExpanded(false)} className="text-white/25 hover:text-white/70 transition-colors" style={{ fontSize: 14, lineHeight: 1 }}>✕</button>
          </div>

          <div className="px-3 pb-2.5 flex gap-2.5 items-center">
            <div
              className="relative flex-shrink-0 rounded-xl overflow-hidden"
              style={{
                width: 'clamp(52px, 12vw, 64px)', height: 'clamp(52px, 12vw, 64px)',
                boxShadow: isPlaying ? '0 0 18px rgba(203,243,12,0.35), inset 0 0 0 1px rgba(203,243,12,0.2)' : 'inset 0 0 0 1px rgba(255,255,255,0.07)',
                transition: 'box-shadow 0.5s',
              }}
            >
              {artwork ? <img src={artwork} className="w-full h-full object-cover" alt="" style={{ display: 'block' }} /> : <ArtPlaceholder large />}
              {isPlaying && (
                <div className="absolute bottom-1 left-1 flex gap-0.5 items-end h-3">
                  {[0, 0.15, 0.07].map((delay, i) => (
                    <div key={i} className="w-0.5 rounded-sm bg-[#cbf30c]"
                      style={{ animation: `tm-bar 0.7s ease-in-out ${delay}s infinite`, height: '100%' }} />
                  ))}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-[11px] leading-snug"
                style={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {trackTitle}
              </p>
              <p className="text-white/40 text-[10px] truncate mt-0.5">{artistName}</p>
              {isBuffering && <p className="text-[#cbf30c]/50 text-[9px] mt-1 animate-pulse">Buffering…</p>}
            </div>
          </div>

          <div className="px-3 pb-1.5">
            <div className="relative h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div className="absolute left-0 top-0 h-full rounded-full"
                style={{ width: `${progress * 100}%`, background: 'linear-gradient(90deg, #cbf30c, #9bc20a)', transition: 'width 0.25s linear' }} />
              <input type="range" min="0" max="1" step="0.001" value={progress} onChange={handleSeek}
                className="absolute inset-0 w-full opacity-0 cursor-pointer" style={{ height: '100%' }} />
            </div>
            <div className="flex justify-between mt-0.5" style={{ color: 'rgba(255,255,255,0.18)', fontSize: 9, fontFamily: 'monospace' }}>
              <span>{fmt(currentTime)}</span><span>{fmt(totalDuration)}</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 px-3 pb-2">
            <button onClick={handlePrev} className="text-white/30 hover:text-white/70 transition-colors active:scale-90"><Prev /></button>
            <button
              onClick={handlePlayPause}
              disabled={tracks.length === 0}
              className="rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-30"
              style={{
                width: 42, height: 42,
                background: 'linear-gradient(135deg, #cbf30c 0%, #8ea809 100%)',
                boxShadow: isPlaying ? '0 0 20px rgba(203,243,12,0.5)' : '0 4px 12px rgba(0,0,0,0.4)',
                transition: 'box-shadow 0.3s',
              }}
            >
              {isBuffering ? <Spinner size={14} dark /> : isPlaying ? <Pause size={13} dark /> : <Play size={13} dark offset />}
            </button>
            <button onClick={handleNext} className="text-white/30 hover:text-white/70 transition-colors active:scale-90"><Next /></button>
          </div>

          <div className="flex items-center gap-2 px-3 pb-3">
            <button onClick={toggleMute} className="text-white/25 hover:text-white/60 flex-shrink-0 transition-colors">
              {isMuted || volume === 0 ? <VolMute /> : <Vol />}
            </button>
            <div className="relative flex-1 h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div className="absolute left-0 top-0 h-full rounded-full bg-white/20" style={{ width: `${(isMuted ? 0 : volume) * 100}%` }} />
              <input type="range" min="0" max="1" step="0.01" value={isMuted ? 0 : volume}
                onChange={e => handleVolumeChange(parseFloat(e.target.value))}
                className="absolute inset-0 w-full opacity-0 cursor-pointer" style={{ height: '100%' }} />
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes tm-art-pulse { 0%,100%{box-shadow:0 0 6px rgba(203,243,12,0.2)} 50%{box-shadow:0 0 14px rgba(203,243,12,0.4)} }
        @keyframes tm-bar { 0%,100%{transform:scaleY(0.3)} 50%{transform:scaleY(1)} }
      `}</style>
    </div>
  );
};

const Play = ({ size, dark, offset }: { size: number; dark?: boolean; offset?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={dark ? 'black' : 'currentColor'} style={offset ? { marginLeft: 2 } : undefined}>
    <path d="M8 5v14l11-7z"/>
  </svg>
);
const Pause = ({ size, dark }: { size: number; dark?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={dark ? 'black' : 'currentColor'}>
    <rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>
  </svg>
);
const Prev = () => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
);
const Next = () => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zm8.5-6V6H17v12h-2.5V12z"/></svg>
);
const Spinner = ({ size, dark }: { size: number; dark?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="animate-spin">
    <circle cx="12" cy="12" r="10" stroke={dark ? 'black' : 'currentColor'} strokeWidth="3" strokeOpacity="0.25"/>
    <path fill={dark ? 'black' : 'currentColor'} d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
  </svg>
);
const Vol = () => (
  <svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
  </svg>
);
const VolMute = () => (
  <svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor">
    <path d="M16.5 12A4.5 4.5 0 0014 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06A8.99 8.99 0 0019 19.73L20.73 21 22 19.73 5.27 2 4.27 3zM12 4 9.91 6.09 12 8.18V4z"/>
  </svg>
);
const ArtPlaceholder = ({ large }: { large?: boolean }) => (
  <div className="w-full h-full flex items-center justify-center" style={{ background: 'rgba(203,243,12,0.04)' }}>
    <svg width={large ? 22 : 14} height={large ? 22 : 14} viewBox="0 0 24 24" fill="rgba(203,243,12,0.25)">
      <path d="M12 3v10.55A4 4 0 1014 17V7h4V3h-6z"/>
    </svg>
  </div>
);
const AudiusLogo = () => (
  <svg width={13} height={13} viewBox="0 0 36 36" fill="none">
    <circle cx="18" cy="18" r="18" fill="#CC147F"/>
    <path d="M10 26L18 10l8 16H10z" fill="white" fillOpacity="0.9"/>
    <path d="M13 22h10" stroke="#CC147F" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

export default AudioPlayer;
