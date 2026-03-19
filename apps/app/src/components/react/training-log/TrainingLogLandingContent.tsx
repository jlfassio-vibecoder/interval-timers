/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unauthenticated Training Log landing: hero, preview, CTA, features.
 */

import React from 'react';
import { Activity, Calendar, Filter, Target, BarChart3, FileSpreadsheet } from 'lucide-react';

const TrainingLogLandingContent: React.FC = () => {
  const handleStartTracking = () => {
    window.dispatchEvent(
      new CustomEvent('showAuthModal', { detail: { fromAppId: 'training-log' } })
    );
  };

  return (
    <div className="relative z-10 mx-auto max-w-3xl px-4 pb-16 pt-24 md:px-6">
      <div className="rounded-2xl border border-white/10 bg-black/20 p-8 md:p-12">
        {/* Hero */}
        <div className="mb-10 text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-white/5">
              <Activity className="h-8 w-8 text-orange-light" aria-hidden />
            </div>
          </div>
          <h1 className="mb-4 font-heading text-2xl font-bold uppercase tracking-tight text-white md:text-3xl">
            Track every workout. See progress. Hit your goals.
          </h1>
          <p className="mx-auto max-w-lg text-white/70">
            Log sessions from timers, programs, and manual entries. Visualize your consistency,
            filter by type, and stay on track with weekly goals.
          </p>
        </div>

        {/* Preview: static 7-column bubble grid */}
        <div className="mb-10">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-white/50">
            Preview
          </p>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="grid grid-cols-7 gap-1">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                <div key={i} className="text-center">
                  <span className="font-mono text-[10px] text-white/40">{day}</span>
                  <div className="mt-2 flex justify-center gap-0.5">
                    {[1, 2].map((j) => (
                      <div
                        key={j}
                        className={`h-6 w-6 rounded-full ${
                          i === 2 && j === 1
                            ? 'bg-orange-500'
                            : i === 4 && j === 1
                              ? 'bg-green-600'
                              : 'bg-white/20'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="mb-10">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-white/50">
            What you get
          </p>
          <ul className="space-y-3 text-sm text-white/80">
            <li className="flex items-center gap-2">
              <Calendar className="h-4 w-4 shrink-0 text-orange-light" aria-hidden />
              Visual calendar with weekly bubble grid
            </li>
            <li className="flex items-center gap-2">
              <Filter className="h-4 w-4 shrink-0 text-orange-light" aria-hidden />
              Filters by type, format, duration
            </li>
            <li className="flex items-center gap-2">
              <Target className="h-4 w-4 shrink-0 text-orange-light" aria-hidden />
              Weekly goals and progress tracking
            </li>
            <li className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 shrink-0 text-orange-light" aria-hidden />
              Analytics and trends
            </li>
            <li className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 shrink-0 text-orange-light" aria-hidden />
              Export to CSV
            </li>
          </ul>
        </div>

        {/* CTA */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleStartTracking}
            className="border-orange-500 bg-orange-600 hover:bg-orange-500 rounded-xl border-2 px-8 py-3 font-bold uppercase tracking-wider text-white transition-colors"
          >
            Start Tracking
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrainingLogLandingContent;
