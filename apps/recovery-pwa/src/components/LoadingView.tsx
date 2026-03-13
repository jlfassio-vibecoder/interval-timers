export default function LoadingView() {
  return (
    <section className="view-section items-center justify-center">
      <span className="loader mb-8" aria-hidden="true" />
      <h2 className="text-xl font-black tracking-widest uppercase">Synthesizing</h2>
      <p className="text-zinc-500 text-sm mt-2 text-center max-w-[250px]">
        Running post-session data through AI performance model...
      </p>
    </section>
  );
}
