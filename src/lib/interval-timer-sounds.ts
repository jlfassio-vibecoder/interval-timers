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

function play(path: string): void {
  if (typeof window === 'undefined') return;
  try {
    let audio = audioCache[path];
    if (!audio) {
      audio = new Audio(path);
      audioCache[path] = audio;
    }
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

export function playBell(): void {
  if (typeof window === 'undefined') return;
  try {
    if (!bellAudioContext) {
      bellAudioContext = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = bellAudioContext;
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(330, ctx.currentTime);
    const now = ctx.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.5, now + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 3);
    osc.start(now);
    osc.stop(now + 3);
  } catch {
    // Ignore (e.g. autoplay policy)
  }
}
