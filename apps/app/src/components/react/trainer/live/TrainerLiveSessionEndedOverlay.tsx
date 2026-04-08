/**
 * Full-viewport overlay when a Trainer Live session has ended (trainer called end session).
 * Shadcn is not used in this app; styling matches Trainer Live (rounded card, orange accents).
 */
import { Trophy } from 'lucide-react';

export default function TrainerLiveSessionEndedOverlay({
  sessionId,
  onClearParticipant,
}: {
  sessionId: string;
  /** Clear sessionStorage participant key before navigating away */
  onClearParticipant: () => void;
}) {
  const go = (path: string) => {
    onClearParticipant();
    window.location.assign(path);
  };

  const resultsHref = `/training-log?liveSession=${encodeURIComponent(sessionId)}`;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4 text-white backdrop-blur-sm"
      role="alertdialog"
      aria-labelledby="trainer-live-ended-title"
      aria-describedby="trainer-live-ended-desc"
    >
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-zinc-950/95 p-8 shadow-[0_0_60px_rgba(234,88,12,0.12)]">
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 ring-2 ring-emerald-400/40">
            <Trophy className="h-9 w-9 text-emerald-400" strokeWidth={1.75} aria-hidden />
          </div>
        </div>
        <h1
          id="trainer-live-ended-title"
          className="mb-2 text-center font-heading text-2xl font-bold uppercase tracking-wide text-orange-light"
        >
          Session complete
        </h1>
        <p id="trainer-live-ended-desc" className="mb-8 text-center text-sm leading-relaxed text-white/70">
          Your trainer has ended the session. Great work today!
        </p>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => go(resultsHref)}
            className="w-full rounded-xl bg-orange-light py-3.5 text-center text-sm font-bold uppercase tracking-wide text-black transition-colors hover:bg-white"
          >
            View my results
          </button>
          <button
            type="button"
            onClick={() => go('/')}
            className="w-full rounded-xl border border-white/20 bg-transparent py-3.5 text-center text-sm font-semibold uppercase tracking-wide text-white/90 transition-colors hover:border-white/35 hover:bg-white/5"
          >
            Return to dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
