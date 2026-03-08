/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowUpRight, Loader2 } from 'lucide-react';
import type { Program } from '@/types';
import FormattedMarkdown from './FormattedMarkdown';
import IntensityBars from './IntensityBars';

interface ProgramsGridProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProgram: (program: Program) => void;
  programs: Program[];
  loading?: boolean;
}

const ProgramsGrid: React.FC<ProgramsGridProps> = ({
  isOpen,
  onClose,
  onSelectProgram,
  programs,
  loading = false,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] overflow-y-auto bg-black/95 px-4 py-20 backdrop-blur-2xl md:px-8"
        >
          <div className="mx-auto max-w-7xl">
            <div className="mb-16 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
              <div>
                <h2 className="mb-2 font-heading text-4xl font-bold uppercase tracking-tighter text-white md:text-7xl">
                  Bodyweight Fusion
                </h2>
                <p className="font-mono text-xs uppercase tracking-[0.3em] text-orange-light">
                  Tactical Progression Architect
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-full border border-white/10 bg-white/5 p-5 text-white transition-all hover:bg-white hover:text-black"
              >
                <X className="h-8 w-8" />
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="h-10 w-10 animate-spin text-orange-light" />
                <span className="ml-3 text-white/60">Loading programs...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 border-l border-t border-white/10 md:grid-cols-2 lg:grid-cols-3">
                {programs.map((program) => (
                  <motion.div
                    key={program.id}
                    onClick={() => onSelectProgram(program)}
                    className="group relative h-[450px] w-full cursor-pointer overflow-hidden border-b border-r border-white/10 bg-black md:h-[550px]"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                  >
                    <div className="absolute inset-0 overflow-hidden">
                      <img
                        src={program.image}
                        alt={program.name}
                        className="h-full w-full object-cover opacity-40 grayscale transition-all duration-700 group-hover:scale-105 group-hover:opacity-100 group-hover:grayscale-0"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                    </div>

                    <div className="absolute inset-0 flex flex-col justify-between p-8">
                      <div className="flex items-start justify-between">
                        <div className="rounded bg-orange-light px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-black">
                          {program.weeks} Weeks
                        </div>
                        <IntensityBars level={program.intensity} />
                      </div>

                      <div>
                        <h3 className="mb-4 font-heading text-2xl font-bold uppercase leading-none tracking-tighter text-white transition-colors group-hover:text-orange-light md:text-4xl">
                          {program.name}
                        </h3>
                        <div className="mb-6 line-clamp-3 text-sm font-light leading-relaxed text-gray-400">
                          <FormattedMarkdown content={program.description || 'No description.'} />
                        </div>
                        <div className="mt-auto flex items-center justify-between border-t border-white/10 pt-6">
                          <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
                            {program.focus}
                          </span>
                          <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase text-white transition-colors group-hover:text-orange-light">
                            {program.programDetail ? 'Review Program' : 'View Program'}{' '}
                            <ArrowUpRight className="h-4 w-4" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ProgramsGrid;
