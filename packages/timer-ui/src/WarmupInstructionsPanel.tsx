/**
 * Step-by-step protocol panel for warmup exercises. Tablet/desktop only (hidden on mobile).
 * Supports close (session) and "Not Show Again" (localStorage).
 */
import React from 'react';
import type { InstructionStep } from '@interval-timers/types';

export interface WarmupInstructionsPanelProps {
  exerciseName: string;
  steps: InstructionStep[];
  onClose: () => void;
  onNeverShowAgain: () => void;
}

const WarmupInstructionsPanel: React.FC<WarmupInstructionsPanelProps> = ({
  exerciseName,
  steps,
  onClose,
  onNeverShowAgain,
}) => {
  if (steps.length === 0) return null;

  return (
    <div className="hidden md:block md:flex md:h-full md:min-h-0 md:max-h-full md:w-full md:max-w-sm md:flex-shrink-0">
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-black/30">
        <div className="shrink-0 flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
          <h4 className="font-display text-sm font-bold text-white/90">
            Step-by-Step Protocol: {exerciseName}
          </h4>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-1 text-lg leading-none text-white/70 hover:text-white"
            aria-label="Close instructions"
          >
            &times;
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-3">
          <ol className="list-none space-y-4 pl-0">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="shrink-0 font-mono text-sm font-bold text-[#ffbf00]">
                  {i + 1}
                </span>
                <div>
                  <span className="block font-bold text-white">{step.title}</span>
                  <span className="mt-0.5 block text-sm leading-relaxed text-white/80">
                    {step.body}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="shrink-0 border-t border-white/10 px-4 py-2">
          <button
            type="button"
            onClick={onNeverShowAgain}
            className="text-xs text-white/60 underline hover:text-white/80"
          >
            Not Show Again
          </button>
        </div>
      </div>
    </div>
  );
};

export default WarmupInstructionsPanel;
