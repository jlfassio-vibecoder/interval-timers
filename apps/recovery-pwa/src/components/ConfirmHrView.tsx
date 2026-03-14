export interface ConfirmHrViewProps {
  heartRate: number;
  onConfirm: () => void;
  onRescan: () => void;
  onEditManually: () => void;
}

export default function ConfirmHrView({ heartRate, onConfirm, onRescan, onEditManually }: ConfirmHrViewProps) {
  return (
    <section className="view-section">
      <header className="text-center mt-4 mb-8">
        <h2 className="text-xl font-black">Confirm Heart Rate</h2>
        <p className="text-zinc-400 text-sm mt-1">
          Make sure this looks correct before continuing
        </p>
      </header>
      <div className="flex-grow flex flex-col items-center gap-8 mt-8">
        <div className="w-full max-w-[200px] py-8 px-6 bg-zinc-800/80 rounded-2xl border-2 border-zinc-600 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">
            Recorded
          </p>
          <p className="text-5xl font-black font-mono text-orange-light" aria-label={`${heartRate} beats per minute`}>
            {heartRate}
          </p>
          <p className="text-sm text-zinc-500 mt-1">BPM</p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-[200px]">
          <button
            type="button"
            onClick={onConfirm}
            className="py-4 px-8 bg-orange text-white rounded-2xl font-black text-lg active:scale-95 transition-transform"
          >
            Confirm
          </button>
          <button
            type="button"
            onClick={onRescan}
            className="py-2 text-zinc-400 hover:text-orange-light text-sm font-semibold"
          >
            Rescan heart rate
          </button>
          <button
            type="button"
            onClick={onEditManually}
            className="py-2 text-zinc-400 hover:text-orange-light text-sm font-semibold"
          >
            Edit manually
          </button>
        </div>
      </div>
    </section>
  );
}
