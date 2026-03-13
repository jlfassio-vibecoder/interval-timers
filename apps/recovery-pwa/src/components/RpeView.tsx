export interface RpeViewProps {
  onSubmit: (val: number, text: string) => void;
}

export default function RpeView({ onSubmit }: RpeViewProps) {
  return (
    <section className="view-section">
      <header className="text-center mt-8 mb-8">
        <h2 className="text-3xl font-black">Rate Your Effort</h2>
        <p className="text-zinc-400 text-sm mt-2">How hard was that AMRAP session?</p>
      </header>

      <div className="grid grid-cols-2 gap-4 flex-grow content-center">
        <button
          type="button"
          onClick={() => onSubmit(1, 'Very Light')}
          className="bg-emerald-950 border-2 border-emerald-800 text-emerald-400 rounded-2xl p-4 font-black text-left active:scale-95 transition min-h-[44px]"
        >
          <span className="text-2xl block mb-1">1-3</span>
          <span className="text-xs uppercase tracking-widest text-emerald-600">Very Light</span>
        </button>
        <button
          type="button"
          onClick={() => onSubmit(4, 'Moderate')}
          className="bg-lime-950 border-2 border-lime-800 text-lime-400 rounded-2xl p-4 font-black text-left active:scale-95 transition min-h-[44px]"
        >
          <span className="text-2xl block mb-1">4-6</span>
          <span className="text-xs uppercase tracking-widest text-lime-600">Moderate</span>
        </button>
        <button
          type="button"
          onClick={() => onSubmit(7, 'Hard')}
          className="bg-amber-950 border-2 border-amber-800 text-amber-400 rounded-2xl p-4 font-black text-left active:scale-95 transition min-h-[44px]"
        >
          <span className="text-2xl block mb-1">7-8</span>
          <span className="text-xs uppercase tracking-widest text-amber-600">
            Hard (Vigorous)
          </span>
        </button>
        <button
          type="button"
          onClick={() => onSubmit(9, 'Very Hard')}
          className="bg-orange-950 border-2 border-orange-800 text-orange-400 rounded-2xl p-4 font-black text-left active:scale-95 transition min-h-[44px]"
        >
          <span className="text-2xl block mb-1">9</span>
          <span className="text-xs uppercase tracking-widest text-orange-600">Very Hard</span>
        </button>
        <button
          type="button"
          onClick={() => onSubmit(10, 'Maximal')}
          className="col-span-2 bg-rose-950 border-2 border-rose-800 text-rose-400 rounded-2xl p-4 font-black text-center active:scale-95 transition min-h-[44px]"
        >
          <span className="text-2xl block mb-1">10</span>
          <span className="text-xs uppercase tracking-widest text-rose-600">
            Maximal (Could not continue)
          </span>
        </button>
      </div>
    </section>
  );
}
