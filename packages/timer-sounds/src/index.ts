/**
 * Shared sound layer for interval timers. Plays files from public/sounds/
 * at the correct phase transitions. User gesture (e.g. starting the timer)
 * is required before playback.
 */

const SOUNDS = {
  workStart: '/sounds/start.wav',
  restStart: '/sounds/school-bell.mp3',
  ready: '/sounds/ready.wav',
  roundComplete: '/sounds/complete.wav',
  cooldownStart: '/sounds/cooldown.ogg',
} as const;

const audioCache: Record<string, HTMLAudioElement> = {};

/** Sound volume multiplier: 0.1 (low) to 1.0 (10x). Default 0.1. */
let soundVolume = 0.1;

export function getSoundVolume(): number {
  return soundVolume;
}

export function setSoundVolume(value: number): void {
  soundVolume = Math.max(0.1, Math.min(1, Number(value)));
}

function play(path: string): void {
  if (typeof window === 'undefined') return;
  try {
    let audio = audioCache[path];
    if (!audio) {
      audio = new Audio(path);
      audioCache[path] = audio;
    }
    audio.volume = soundVolume;
    try {
      audio.currentTime = 0;
    } catch {
      // Ignore currentTime reset errors (e.g. if not enough data is loaded yet)
    }
    audio.play().catch(() => {
      // Ignore play errors (e.g. autoplay policy)
    });
  } catch {
    // Ignore construction or play errors (e.g. autoplay policy)
  }
}

export function playWorkStart(): void {
  play(SOUNDS.workStart);
}

export function playRestStart(): void {
  play(SOUNDS.restStart);
}

export function playReady(): void {
  play(SOUNDS.ready);
}

export function playRoundComplete(): void {
  play(SOUNDS.roundComplete);
}

export function playCooldownStart(): void {
  play(SOUNDS.cooldownStart);
}

/** Synthesized bell (E4, 330Hz) for warmup exercise start/end. Web Audio API, no file. */
let bellAudioContext: AudioContext | null = null;

function getBellContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!bellAudioContext) {
      bellAudioContext = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return bellAudioContext;
  } catch {
    return null;
  }
}

export function playBell(): void {
  const ctx = getBellContext();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(330, ctx.currentTime);
    const now = ctx.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.5 * soundVolume, now + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 3);
    osc.start(now);
    osc.stop(now + 3);
  } catch {
    // Ignore (e.g. autoplay policy)
  }
}

/** Short chime (E4, 330Hz) ~0.2s for interval beeps. */
function playShortChime(ctx: AudioContext, atTime: number): void {
  try {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(330, atTime);
    gainNode.gain.setValueAtTime(0, atTime);
    gainNode.gain.linearRampToValueAtTime(0.4 * soundVolume, atTime + 0.03);
    gainNode.gain.exponentialRampToValueAtTime(0.001, atTime + 0.2);
    osc.start(atTime);
    osc.stop(atTime + 0.2);
  } catch {
    // Ignore
  }
}

/** Play n short beeps (for start of interval: 3, for transition: 1). ~0.35s per beep with gap. */
export function playBeeps(count: number): void {
  const ctx = getBellContext();
  if (!ctx || count < 1) return;
  try {
    const gap = 0.35;
    for (let i = 0; i < count; i++) {
      playShortChime(ctx, ctx.currentTime + i * gap);
    }
  } catch {
    // Ignore
  }
}

/** One long tone (1.5s) for end of interval block / start cooldown. */
export function playLongTone(durationSeconds: number = 1.5): void {
  const ctx = getBellContext();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(330, ctx.currentTime);
    const now = ctx.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.4 * soundVolume, now + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + durationSeconds);
    osc.start(now);
    osc.stop(now + durationSeconds);
  } catch {
    // Ignore
  }
}
