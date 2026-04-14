export type EmomTimerPanelPhase = 'warmup' | 'setup' | 'working' | 'resting' | 'finished';

export interface EmomTimerPanelProps {
  phase: EmomTimerPanelPhase;
  /** Seconds shown as the main `00:SS` clock (warmup/setup countdown or seconds-in-minute). */
  mainClockSeconds: number;
  headerBgClass: string;
  headerEyebrow: string;
  title: string;
  subtitle: string;
  setupDurationSeconds: number;
  /** Progress ring: setup uses (setupDurationSeconds - countdownRemaining)/setupDurationSeconds; work uses secondsInMinute/60 */
  secondsInMinute: number;
  /** Warmup or setup countdown remaining (same as mainClockSeconds during those phases in the standalone timer). */
  countdownRemaining: number;
  taskFinishedAt: number | null;
  onTaskComplete?: () => void;
  isPaused: boolean;
  onPauseToggle: () => void;
  onSkip: () => void;
  skipButtonLabel: string;
  showCloseButton?: boolean;
  onClose?: () => void;
  /** Standalone timer shows pause/skip; Trainer Live embed omits these (server-driven clock). */
  showFooterControls?: boolean;
  /** Optional weight log (Trainer Live embed). */
  showWeightInput?: boolean;
  /** When true, weight field is read-only (e.g. log work before entering weight). */
  weightInputDisabled?: boolean;
  weightValue?: string;
  onWeightChange?: (value: string) => void;
  onWeightCommit?: () => void;
  /** When true, omit full-screen fixed positioning (fills parent in Trainer Live). */
  embed?: boolean;
}

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return s < 10 ? `0${s}` : `${s}`;
}

/**
 * Presentational EMOM timer: phase header, main clock, task complete, optional weight, pause/skip.
 * Does not run timers — parent owns schedule and passes props each tick.
 */
export default function EmomTimerPanel({
  phase,
  mainClockSeconds,
  headerBgClass,
  headerEyebrow,
  title,
  subtitle,
  setupDurationSeconds,
  secondsInMinute,
  countdownRemaining,
  taskFinishedAt,
  onTaskComplete,
  isPaused,
  onPauseToggle,
  onSkip,
  skipButtonLabel,
  showCloseButton,
  onClose,
  showWeightInput,
  weightInputDisabled,
  weightValue,
  onWeightChange,
  onWeightCommit,
  embed,
  showFooterControls = true,
}: EmomTimerPanelProps) {
  const ringProgress =
    phase === 'setup'
      ? (setupDurationSeconds - countdownRemaining) / setupDurationSeconds
      : secondsInMinute / 60;

  const shell = (
    <div
      className={`flex h-full min-h-0 w-full min-w-0 flex-col bg-[#0d0500] text-white ${embed ? '' : 'animate-zoom-in fixed inset-0 z-[200]'}`}
    >
      <div
        className={`flex shrink-0 items-center justify-between border-b border-white/10 p-4 text-white transition-colors duration-200 md:p-6 ${headerBgClass}`}
      >
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-widest opacity-80 md:text-xs">
            {headerEyebrow}
          </div>
          <h3 className="font-display text-xl font-bold leading-tight md:text-3xl">{title}</h3>
          <p className="mt-1 text-xs opacity-90 md:text-sm">{subtitle}</p>
        </div>
        {showCloseButton && onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/20 font-bold text-white hover:bg-black/40"
          >
            &times;
          </button>
        ) : null}
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden p-4">
        <div className="relative z-10 mb-6 w-full max-w-lg text-center">
          <div
            className={`font-mono text-8xl font-bold tabular-nums leading-none tracking-tighter drop-shadow-2xl md:text-[180px] ${phase === 'working' ? 'text-teal-400' : 'text-white/40'}`}
          >
            00:{formatTime(mainClockSeconds)}
          </div>

          {phase === 'working' && onTaskComplete ? (
            <div className="mt-8">
              <button
                type="button"
                onClick={onTaskComplete}
                className="animate-pulse rounded-2xl bg-teal-500 px-12 py-6 text-xl font-bold text-black shadow-[0_0_40px_rgba(45,212,191,0.4)] hover:bg-teal-400"
              >
                TASK COMPLETE
              </button>
            </div>
          ) : null}

          {phase === 'resting' && taskFinishedAt !== null ? (
            <div className="animate-fade-in mt-8 text-center">
              <div className="mb-2 text-sm uppercase tracking-widest text-white/60">Rest Earned</div>
              <div className="text-4xl font-bold text-teal-400">{60 - taskFinishedAt}s</div>
              <div className="mt-2 text-xs text-white/40">Wait for next minute</div>
            </div>
          ) : null}

          {showWeightInput ? (
            <div className="mx-auto mt-8 max-w-xs text-left">
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-white/50">
                Weight (optional)
              </label>
              <input
                type="text"
                value={weightValue ?? ''}
                disabled={weightInputDisabled}
                onChange={(e) => onWeightChange?.(e.target.value)}
                onBlur={() => onWeightCommit?.()}
                placeholder="e.g. 135 lb"
                className="w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          ) : null}
        </div>

        <div className="pointer-events-none absolute inset-0 opacity-20">
          <svg className="h-full w-full" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" fill="none" stroke="#1e293b" strokeWidth="2" />
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke={phase === 'working' ? '#2dd4bf' : '#475569'}
              strokeWidth="2"
              strokeDasharray={`${Math.min(1, Math.max(0, ringProgress)) * 251.2} 251.2`}
              transform="rotate(-90 50 50)"
            />
          </svg>
        </div>
      </div>

      {showFooterControls ? (
        <div className="relative z-20 flex shrink-0 items-center justify-between gap-3 border-t border-white/10 bg-black p-4 md:p-8">
          <button
            type="button"
            onClick={onPauseToggle}
            className="w-1/3 rounded-xl border border-white/20 bg-white/10 px-4 py-3 font-bold text-white hover:bg-white/20 md:px-8 md:py-4"
          >
            {isPaused ? 'RESUME' : 'PAUSE'}
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="w-1/3 rounded-xl px-4 py-3 font-bold text-white/60 hover:text-white md:px-8 md:py-4"
          >
            {skipButtonLabel}
          </button>
        </div>
      ) : null}
    </div>
  );

  return shell;
}
