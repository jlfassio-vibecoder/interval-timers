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
