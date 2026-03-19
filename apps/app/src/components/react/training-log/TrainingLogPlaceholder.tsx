/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Placeholder for Training Log page. Replace with full TrainingLog in Phase 3.
 */

import React from 'react';
import { Activity, ArrowRight } from 'lucide-react';

const TrainingLogPlaceholder: React.FC = () => {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-white/5">
        <Activity className="h-8 w-8 text-orange-light" aria-hidden />
      </div>
      <h1 className="font-heading text-2xl font-bold uppercase tracking-tight text-white md:text-3xl">
        Training Log
      </h1>
      <p className="max-w-md text-white/70">
        Track every workout, see your progress, and hit your goals. Coming soon.
      </p>
      <a
        href="/interval-timers"
        className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 py-2 font-mono text-sm font-bold uppercase tracking-wider text-orange-light transition hover:bg-white/10 hover:text-white"
      >
        View HUD
        <ArrowRight className="h-4 w-4" aria-hidden />
      </a>
    </div>
  );
};

export default TrainingLogPlaceholder;
