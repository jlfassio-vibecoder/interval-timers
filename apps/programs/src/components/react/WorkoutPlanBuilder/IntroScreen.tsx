import { Play } from 'lucide-react';

interface IntroScreenProps {
  onComplete: () => void;
}

export function IntroScreen({ onComplete }: IntroScreenProps) {
  return (
    <div className="relative mx-auto flex w-full max-w-[600px] flex-col items-center justify-start overflow-hidden rounded-2xl border border-white/10 bg-bg-dark px-6 pb-12 pt-8">
      <div className="from-orange-light/10 pointer-events-none absolute inset-0 bg-gradient-to-b via-bg-dark to-black" />
      <div className="relative z-10 text-center">
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-white md:text-5xl">
          AI PERSONAL <br />
          <span className="bg-gradient-to-r from-orange-medium to-orange-light bg-clip-text text-transparent">
            TRAINER
          </span>
        </h1>
        <p className="mx-auto mb-8 max-w-[500px] text-sm leading-relaxed text-slate-400 md:text-lg">
          Experience the Live Coach Engine that adapts your sets, reps, and weights in real-time
          based on your fatigue.
        </p>
        <button
          type="button"
          onClick={onComplete}
          className="cta-primary border-orange-light/50 hover:bg-orange-light/20 group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full border bg-transparent transition-all"
        >
          <span className="relative z-10 text-sm font-bold uppercase tracking-wider text-orange-light transition-colors group-hover:text-bg-dark">
            Generate Workout
          </span>
          <Play className="relative z-10 h-4 w-4 text-orange-light transition-colors group-hover:text-bg-dark" />
        </button>
      </div>
      <button
        type="button"
        onClick={onComplete}
        className="absolute right-6 top-6 rounded-full border border-transparent px-4 py-2 text-xs uppercase tracking-wider text-slate-500 transition-all hover:border-white/10 hover:text-white"
      >
        Free Workout
      </button>
    </div>
  );
}
