/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Renders rule-based insights from the Training Log analytics.
 */

import React from 'react';
import { Lightbulb } from 'lucide-react';
import type { TrainingLogInsight } from '@/lib/training-log-insights';

export interface InsightsPanelProps {
  insights: TrainingLogInsight[];
}

const CATEGORY_LABELS: Record<TrainingLogInsight['category'], string> = {
  volume: 'Volume',
  balance: 'Balance',
  recency: 'Recency',
  consistency: 'Consistency',
};

const InsightsPanel: React.FC<InsightsPanelProps> = ({ insights }) => {
  if (insights.length === 0) return null;

  return (
    <div
      id="insights-panel"
      className="rounded-xl border border-white/10 bg-white/5 p-4"
      aria-label="Training insights"
    >
      <h4 className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.4em] text-white/60">
        <Lightbulb className="h-3.5 w-3.5" aria-hidden />
        Insights
      </h4>
      <ul className="space-y-2">
        {insights.map((insight) => (
          <li
            key={insight.id}
            className="flex flex-wrap items-start gap-2 rounded-lg border border-white/5 bg-white/5 px-3 py-2"
          >
            <span
              className="shrink-0 rounded font-mono text-[9px] uppercase tracking-wider text-white/40"
              aria-hidden
            >
              {CATEGORY_LABELS[insight.category]}
            </span>
            <span className="text-sm text-white/90">{insight.text}</span>
            {insight.link && (
              <a
                href={insight.link.scrollTo ? `#${insight.link.scrollTo}` : undefined}
                className="hover:text-orange-300 text-xs font-medium text-orange-light transition-colors"
              >
                {insight.link.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default InsightsPanel;
