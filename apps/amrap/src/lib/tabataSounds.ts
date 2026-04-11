/**
 * Pleasant deep-bell / soft-gong cues for Tabata phase transitions (Trainer Live embed).
 * Web Audio only — no asset files; respects same AudioContext pattern as AMRAP sounds.
 */
import { getOrCreateAudioContext } from './amrapSounds';

const ctxRef: { current: AudioContext | null } = { current: null };

/** Layered sine partials with exponential decay — reads as a struck bell / small gong. */
function strikeBellLayered(
  ctx: AudioContext,
  fundamentalHz: number,
  durationSec: number,
  peakGain: number
): void {
  const now = ctx.currentTime;
  const partials: { ratio: number; level: number }[] = [
    { ratio: 1, level: 1 },
    { ratio: 2.01, level: 0.35 },
    { ratio: 3.02, level: 0.12 },
  ];
  const master = ctx.createGain();
  master.connect(ctx.destination);
  master.gain.setValueAtTime(0, now);
  master.gain.linearRampToValueAtTime(peakGain, now + 0.025);
  master.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

  for (const p of partials) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(fundamentalHz * p.ratio, now);
    g.gain.setValueAtTime(p.level, now);
    osc.connect(g);
    g.connect(master);
    osc.start(now);
    osc.stop(now + durationSec + 0.05);
  }
}

/** Start of work interval — clear, energizing mid bell. */
export function playTabataWorkStartSound(): void {
  const ctx = getOrCreateAudioContext(ctxRef);
  if (!ctx) return;
  try {
    strikeBellLayered(ctx, 523, 0.42, 0.32);
  } catch {
    // Autoplay / AudioContext policy
  }
}

/** Start of rest — deeper, softer gong. */
export function playTabataRestStartSound(): void {
  const ctx = getOrCreateAudioContext(ctxRef);
  if (!ctx) return;
  try {
    strikeBellLayered(ctx, 196, 0.85, 0.26);
  } catch {
    // Autoplay / AudioContext policy
  }
}
