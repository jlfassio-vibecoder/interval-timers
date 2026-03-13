export interface ResultsViewProps {
  captureDelayMs: number;
  finalHr: number;
  rpeVal: number;
  rpeText: string;
  onClose: () => void;
}

function formatDelay(ms: number): string {
  const secs = Math.floor(ms / 1000);
  const m = Math.floor(secs / 60)
    .toString()
    .padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `+${m}:${s}`;
}

function AiInsightContent({ finalHr, delaySecs }: { finalHr: number; delaySecs: number }) {
  return (
    <>
      <strong className="text-orange-light">WORK CAPACITY & DENSITY</strong>
      <br />
      You maintained an incredible mechanical output today. Completing 9 rounds in 15 minutes means
      you moved through a full station roughly every 1 minute and 40 seconds. Sustaining 60lb
      single-leg split squats at this pace requires immense localized muscular endurance.
      <br />
      <br />
      <span className="text-zinc-400">
        • <strong className="text-white">Population Comparison:</strong> The ability to move a 60lb
        external load dynamically on a single leg for 90 total reps per leg places your lower-body
        strength-endurance in the{' '}
        <strong className="text-orange-light">Top 5% for males aged 50-55</strong>. The average
        51-year-old in the general population struggles with unweighted split squats for a single set
        of 10.
      </span>
      <br />
      <br />
      <strong className="text-orange-light">CARDIOVASCULAR RECOVERY</strong>
      <br />
      Your heart rate recovery (HRR) is the standout metric of this session. Dropping to{' '}
      <strong className="text-orange-light">
        {finalHr} BPM within {delaySecs} seconds
      </strong>{' '}
      of a threshold-level AMRAP indicates elite parasympathetic nervous system function.
      <br />
      <br />
      <span className="text-zinc-400">
        • <strong className="text-white">Population Comparison:</strong> A normal healthy HR drop is
        roughly 15-20 beats in the first minute. A drop of this magnitude places your cardiovascular
        elasticity and recovery efficiency in the{' '}
        <strong className="text-orange-light">
          Top 1% to 2% of the general population for your age
        </strong>
        . Your heart functions like someone a decade and a half younger.
      </span>
    </>
  );
}

export default function ResultsView({
  captureDelayMs,
  finalHr,
  rpeVal,
  rpeText,
  onClose,
}: ResultsViewProps) {
  const delaySecs = Math.floor(captureDelayMs / 1000);

  return (
    <section className="view-section">
      <header className="mt-4 mb-6 flex justify-between items-center">
        <h2 className="text-2xl font-black">Recovery Profile</h2>
        <div className="text-2xl" aria-hidden="true">🧠</div>
      </header>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800">
          <span className="text-[10px] font-bold uppercase text-zinc-500 tracking-widest">
            Capture Delay
          </span>
          <div className="text-xl font-black font-mono text-zinc-100 mt-1">
            {formatDelay(captureDelayMs)}
          </div>
        </div>
        <div className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800">
          <span className="text-[10px] font-bold uppercase text-zinc-500 tracking-widest">
            Recov. HR
          </span>
          <div className="text-xl font-black font-mono text-orange-light mt-1">
            {finalHr} <span className="text-xs">BPM</span>
          </div>
        </div>
        <div className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 col-span-2 flex justify-between items-center">
          <span className="text-[10px] font-bold uppercase text-zinc-500 tracking-widest">
            Reported RPE
          </span>
          <div className="text-lg font-black text-amber-400">
            {rpeVal}/10 ({rpeText})
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-orange-darkest/60 to-zinc-900 border border-orange-dark/50 p-6 rounded-3xl flex-grow overflow-y-auto mb-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-orange-light text-xl" aria-hidden="true">✨</span>
          <h3 className="font-bold text-orange-light uppercase tracking-widest text-xs">
            AI Insight
          </h3>
        </div>
        <div className="text-zinc-300 text-sm leading-relaxed">
          <AiInsightContent finalHr={finalHr} delaySecs={delaySecs} />
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="w-full py-4 bg-zinc-800 text-white rounded-2xl font-bold hover:bg-zinc-700 transition active:scale-95 min-h-[48px] border border-white/10"
      >
        Done
      </button>
    </section>
  );
}
