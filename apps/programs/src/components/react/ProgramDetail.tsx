/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Cpu, Activity, Layers } from 'lucide-react';
import type { Program } from '@/types';
import IntensityBars from './IntensityBars';

interface ProgramDetailProps {
  program: Program | null;
  onClose: () => void;
  onActivate: () => void;
}

const ProgramDetail: React.FC<ProgramDetailProps> = ({ program, onClose, onActivate }) => {
  if (!program) return null;

  return (
    <AnimatePresence>
      {program && (
        <motion.div
          initial={{ opacity: 0, x: '100%' }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 200 }}
          className="fixed inset-0 z-[80] cursor-auto overflow-y-auto bg-bg-dark"
        >
          <div className="relative h-[40vh] w-full md:h-[60vh]">
            <img
              src={program.image}
              alt={program.name}
              width={1200}
              height={630}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover opacity-50 grayscale"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-bg-dark to-transparent" />

            <div className="absolute left-10 right-10 top-10 flex items-center justify-between">
              <button
                onClick={onClose}
                className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 font-mono text-xs font-bold uppercase tracking-widest transition-colors hover:bg-white hover:text-black"
              >
                <ChevronLeft className="h-4 w-4" /> Back to Lineup
              </button>
              <div className="hidden items-center gap-4 rounded-full border border-white/10 bg-black/40 px-6 py-3 backdrop-blur-md md:flex">
                <span className="font-mono text-xs uppercase tracking-tighter text-orange-light">
                  Intensity Level
                </span>
                <IntensityBars level={program.intensity} />
              </div>
            </div>

            <div className="absolute bottom-12 left-10 right-10">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <h2 className="mb-4 font-heading text-4xl font-black uppercase leading-none tracking-tighter text-white drop-shadow-2xl md:text-9xl">
                  {program.name}
                </h2>
                <div className="flex items-center gap-6">
                  <span className="rounded bg-orange-light px-4 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-black">
                    {program.weeks} WEEK OPERATIONAL WINDOW
                  </span>
                  <span className="font-mono text-xs uppercase tracking-[0.2em] text-white/60">
                    {program.focus}
                  </span>
                </div>
              </motion.div>
            </div>
          </div>

          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-16 px-6 py-16 lg:grid-cols-12">
            <div className="space-y-12 lg:col-span-5">
              <section>
                <h4 className="mb-6 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.4em] text-orange-light">
                  <Layers className="h-4 w-4" /> Operational Overview
                </h4>
                <p className="text-xl font-light italic leading-tight text-gray-200 md:text-3xl">
                  "{program.programDetail?.overview}"
                </p>
              </section>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
                  <Cpu className="mb-4 h-8 w-8 text-orange-light" />
                  <h5 className="mb-2 font-heading text-sm font-bold uppercase">Neural Rec</h5>
                  <p className="text-[10px] uppercase leading-relaxed tracking-widest text-white/40">
                    Optimization of CNS motor recruitment.
                  </p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
                  <Activity className="mb-4 h-8 w-8 text-orange-light" />
                  <h5 className="mb-2 font-heading text-sm font-bold uppercase">Bio-Feedback</h5>
                  <p className="text-[10px] uppercase leading-relaxed tracking-widest text-white/40">
                    Real-time HRV and efficiency tracking.
                  </p>
                </div>
              </div>

              <button
                onClick={onActivate}
                className="w-full rounded-3xl bg-gradient-to-r from-orange-light to-orange-dark py-8 font-black uppercase tracking-[0.3em] text-black shadow-[0_20px_50px_rgba(255,191,0,0.2)] transition-transform hover:scale-[1.02]"
              >
                Activate Protocol Now
              </button>
            </div>

            <div className="space-y-12 lg:col-span-7">
              <h4 className="mb-4 font-mono text-[10px] uppercase tracking-[0.4em] text-white/30">
                Program Phases
              </h4>
              {program.programDetail?.phases.map((phase, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="group relative border-l border-white/10 pb-16 pl-12 last:pb-0"
                >
                  <div className="absolute left-[-7px] top-0 h-[14px] w-[14px] rounded-full bg-orange-light shadow-[0_0_20px_#ffbf00]" />
                  <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <div>
                      <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-orange-light">
                        {phase.weeks}
                      </span>
                      <h5 className="font-heading text-4xl font-bold uppercase leading-none tracking-tighter text-white transition-colors group-hover:text-orange-light">
                        {phase.title}
                      </h5>
                    </div>
                    <span className="h-fit rounded-full border border-white/10 bg-white/5 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/30">
                      {phase.focus}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {phase.deliverables.map((item, dIdx) => (
                      <div
                        key={dIdx}
                        className="hover:border-orange-light/30 flex items-center gap-4 rounded-2xl border border-white/5 bg-white/5 p-5 transition-all"
                      >
                        <div className="h-2 w-2 rounded-full bg-orange-light shadow-[0_0_10px_#ffbf00]" />
                        <span className="text-xs font-bold uppercase leading-relaxed tracking-widest text-gray-400">
                          {item}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ProgramDetail;
