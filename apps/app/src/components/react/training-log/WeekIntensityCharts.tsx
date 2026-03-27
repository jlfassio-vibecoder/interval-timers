/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Week intensity visualizations for Training Log.
 */

import React, { useMemo } from 'react';
import type { ProfileBaseline } from '@/lib/met';
import type { TrainingLogFilters } from '@/lib/training-log-filters';
import type { TrainingLogWeek } from '@/lib/supabase/client/training-log';
import {
  buildWeekIntensitySeries,
  MAX_WEEK_INTENSITY_SESSIONS,
} from '@/lib/training-log-week-intensity';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export interface WeekIntensityChartsProps {
  week: TrainingLogWeek;
  filters?: TrainingLogFilters;
  profileBaseline: ProfileBaseline | null;
}

const WeekIntensityCharts: React.FC<WeekIntensityChartsProps> = ({
  week,
  filters,
  profileBaseline,
}) => {
  const series = useMemo(
    () => buildWeekIntensitySeries(week, filters, profileBaseline),
    [week, filters, profileBaseline]
  );

  if (series.totalSessions === 0) {
    return (
      <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
        <p className="text-center font-mono text-[10px] uppercase italic text-white/45">
          No intensity data for this week with current filters.
        </p>
      </div>
    );
  }

  const barData = series.sessions.map((session, index) => ({
    idx: index + 1,
    name: `${DAY_LABELS[session.dayIndex]} ${index + 1}`,
    intensity: session.intensityPercent,
    workoutName: session.workoutName,
    effort: session.effort,
    durationMinutes: session.durationMinutes,
    metValue: session.metValue,
  }));

  const waveData = DAY_LABELS.map((dayLabel, idx) => ({
    day: dayLabel,
    intensity: series.dailyIntensityPercent[idx] ?? 0,
  }));

  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3 sm:p-4">
      <h5 className="text-orange-light/90 mb-2 font-mono text-[10px] uppercase tracking-[0.25em]">
        Intensity
      </h5>

      <div className="mb-5 min-w-0">
        <p className="mb-2 text-xs text-white/65">Session intensity by workout (0-100%)</p>
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} barCategoryGap="18%">
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis
                dataKey="name"
                stroke="rgba(255,255,255,0.45)"
                tick={{ fontSize: 10 }}
                interval={0}
                angle={-35}
                textAnchor="end"
                height={44}
              />
              <YAxis
                domain={[0, 100]}
                stroke="rgba(255,255,255,0.45)"
                tick={{ fontSize: 10 }}
                tickCount={6}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(5,5,5,0.95)',
                  border: '1px solid rgba(255,255,255,0.15)',
                }}
                formatter={(value: unknown) => [`${Number(value ?? 0)}%`, 'Intensity']}
                labelFormatter={(_, payload) => {
                  const p = payload?.[0]?.payload as
                    | {
                        workoutName?: string;
                        effort?: number;
                        durationMinutes?: number;
                        metValue?: number | null;
                      }
                    | undefined;
                  if (!p) return '';
                  const met = p.metValue != null ? ` · MET ${p.metValue}` : '';
                  return `${p.workoutName ?? 'Workout'} · Effort ${p.effort ?? 5}/10 · ${p.durationMinutes ?? 0} min${met}`;
                }}
              />
              <Bar dataKey="intensity" fill="#ffbf00" radius={[3, 3, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {series.truncated ? (
          <p className="mt-2 text-xs text-white/55">
            Showing {MAX_WEEK_INTENSITY_SESSIONS} of {series.totalSessions} sessions. Narrow filters
            to view all workouts.
          </p>
        ) : null}
      </div>

      <div>
        <p className="mb-2 text-xs text-white/65">Daily intensity wave (duration-weighted)</p>
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={waveData}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="day" stroke="rgba(255,255,255,0.45)" tick={{ fontSize: 11 }} />
              <YAxis
                domain={[0, 100]}
                stroke="rgba(255,255,255,0.45)"
                tick={{ fontSize: 10 }}
                tickCount={6}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(5,5,5,0.95)',
                  border: '1px solid rgba(255,255,255,0.15)',
                }}
                formatter={(value: unknown) => [`${Number(value ?? 0)}%`, 'Intensity']}
              />
              <Area
                type="monotone"
                dataKey="intensity"
                stroke="#ffbf00"
                fill="#ffbf00"
                fillOpacity={0.2}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-white/45">
        Estimated from logged effort and workout modality (MET). This is guidance, not a medical
        metric.
      </p>
    </div>
  );
};

export default WeekIntensityCharts;
