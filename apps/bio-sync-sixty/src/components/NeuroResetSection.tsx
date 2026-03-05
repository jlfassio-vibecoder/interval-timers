import React, { useEffect, useState, useId } from 'react';
import { BASE } from '../constants';

export interface NeuroResetSectionProps {
  /** When true, used inside ScienceSection grid (reduced padding, no max-width). */
  embedded?: boolean;
}

function NeuroResetSection({ embedded = false }: NeuroResetSectionProps) {
  const [stressWidth, setStressWidth] = useState(80);
  const [vagalWidth, setVagalWidth] = useState(25);
  const [stressLabel, setStressLabel] = useState('DECREASING');
  const [stressLabelClass, setStressLabelClass] = useState('text-xs text-rose-500 font-bold');
  const gradientId = useId().replace(/:/g, '-');

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    function runCycle() {
      setStressWidth(20);
      setVagalWidth(90);
      setStressLabel('OPTIMIZED');
      setStressLabelClass('text-xs text-cyan-400 font-bold');
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        setStressWidth(80);
        setVagalWidth(25);
        setStressLabel('RECOVERY REQUIRED');
        setStressLabelClass('text-xs text-rose-500 font-bold');
      }, 6000);
    }
    runCycle();
    const interval = setInterval(runCycle, 12000);
    return () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      clearInterval(interval);
    };
  }, []);

  return (
    <section className={`bg-[#020617] text-slate-100 overflow-x-hidden rounded-2xl ${embedded ? 'p-4 md:p-6' : ''}`} aria-labelledby="neuro-reset-heading">
      {/* Hero */}
      <div className={embedded ? 'px-0 pt-8 pb-6 text-center' : 'max-w-4xl mx-auto px-6 pt-24 pb-12 text-center'}>
        <h2 id="neuro-reset-heading" className={`font-extrabold tracking-tight leading-tight ${embedded ? 'text-2xl md:text-4xl mb-4' : 'text-4xl md:text-6xl mb-8'}`}>
          Mechanically <span className="text-cyan-400">Force</span> Calm.
        </h2>
        <p className={`text-slate-400 leading-relaxed ${embedded ? 'text-sm' : 'text-lg max-w-2xl mx-auto'}`}>
          By triggering the <strong>Trigeminal-Vagal Axis</strong> via cold exposure, we activate a conserved evolutionary reflex to instantly lower anxiety baselines.
        </p>
      </div>

      {/* Main Visualization */}
      <div className={embedded ? 'px-0 pb-8' : 'max-w-5xl mx-auto px-6 pb-24'}>
        <div className={`relative bg-slate-900/30 border border-white/5 overflow-hidden backdrop-blur-xl ${embedded ? 'rounded-2xl p-6' : 'rounded-[3rem] p-12'}`}>
          <div className={`grid gap-8 items-center ${embedded ? 'grid-cols-1' : 'lg:grid-cols-2 gap-16'}`}>
            {/* Neural Schematic SVG */}
            <div className="relative flex justify-center items-center">
              <div className="absolute w-64 h-64 bg-cyan-500/10 blur-[100px] rounded-full" aria-hidden="true" />
              <svg viewBox="0 0 200 240" className="w-full max-w-[320px] h-auto relative z-10" aria-hidden="true">
                <defs>
                  <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={0} />
                    <stop offset="50%" stopColor="#22d3ee" stopOpacity={1} />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <path
                  d="M100,20 C140,20 170,50 170,95 C170,140 140,170 100,170 C60,170 30,140 30,95 C30,50 60,20 100,20"
                  fill="none"
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth={1}
                />
                <circle cx={150} cy={85} r={3} fill="#22d3ee" className="glow-pulse" style={{ animationDelay: '0s' }} />
                <circle cx={150} cy={115} r={3} fill="#22d3ee" className="glow-pulse" style={{ animationDelay: '0.2s' }} />
                <path
                  d="M150,100 Q110,100 100,135"
                  fill="none"
                  stroke={`url(#${gradientId})`}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  className="neural-path"
                />
                <path
                  d="M100,135 Q100,175 100,210"
                  fill="none"
                  stroke={`url(#${gradientId})`}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  className="neural-path"
                  style={{ animationDelay: '1.5s' }}
                />
                <circle cx={100} cy={210} r={5} fill="#22d3ee" className="glow-pulse" style={{ animationDelay: '2.5s' }} />
              </svg>
            </div>

            {/* Gauges */}
            <div className={embedded ? 'space-y-6' : 'space-y-12'}>
              <div>
                <div className="flex justify-between items-end mb-4">
                  <h3 className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Sympathetic Load</h3>
                  <span className={stressLabelClass} id="stress-level">{stressLabel}</span>
                </div>
                <div className="h-[2px] w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    id="stress-bar"
                    className="h-full bg-rose-500/50 transition-all duration-[4000ms]"
                    style={{ width: `${stressWidth}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-end mb-4">
                  <h3 className="text-xs uppercase tracking-widest text-cyan-500 font-semibold">Vagal Tone</h3>
                  <div className="flex items-center gap-[3px] h-[60px]" aria-hidden="true">
                    {Array.from({ length: 15 }, (_, i) => (
                      <div
                        key={i}
                        className="wave-bar w-[3px] bg-cyan-400 rounded-sm"
                        style={{ animationDelay: `${i * 0.1}s` }}
                      />
                    ))}
                  </div>
                </div>
                <div className="h-[2px] w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    id="vagal-bar"
                    className="h-full bg-cyan-400 transition-all duration-[4000ms]"
                    style={{ width: `${vagalWidth}%` }}
                  />
                </div>
              </div>

              <p className="text-slate-500 text-sm italic leading-relaxed pt-8 border-t border-white/5">
                Facial cooling creates a direct bio-electrical circuit to the brain's autonomic center, forcing a transition from stress-arousal to systemic recovery.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content Blocks */}
      <div className={`${embedded ? 'px-0' : 'max-w-4xl mx-auto px-6'} grid md:grid-cols-2 gap-12 border-t border-white/5 ${embedded ? 'pt-8' : 'pt-16'}`}>
        <div>
          <h3 className="text-xl font-bold mb-4">Thermal Trigger</h3>
          <p className="text-slate-500 text-sm leading-relaxed">
            Sudden cooling of the paranasal region activates specialized thermal receptors. This isn't just a sensation—it's a command to the brainstem to prioritize survival through calm.
          </p>
        </div>
        <div>
          <h3 className="text-xl font-bold mb-4">The Vagal Brake</h3>
          <p className="text-slate-500 text-sm leading-relaxed">
            The nervous system immediately shifts. Cardiac output is optimized, peripheral vessels constrict, and the brain enters a state of high-coherence alertness.
          </p>
        </div>
      </div>

      {/* Deep Dive CTA */}
      <div className={`${embedded ? 'px-0 pt-8 pb-0' : 'max-w-4xl mx-auto px-6 pt-12 pb-16'} text-center`}>
        <a
          href={`${BASE}/neuro`}
          className="inline-flex items-center justify-center gap-2 bg-cyan-500/20 text-cyan-400 font-bold py-3 px-6 rounded-lg border border-cyan-500/30 hover:bg-cyan-500/30 transition-colors"
        >
          <span aria-hidden="true">🧠</span>
          <span>Deep Dive: The Neuro-Reset</span>
        </a>
      </div>
    </section>
  );
}

export default NeuroResetSection;
