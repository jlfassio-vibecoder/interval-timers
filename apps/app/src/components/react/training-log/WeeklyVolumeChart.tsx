/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Weekly volume trend chart (minutes per week). Uses Recharts.
 */

import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

export interface WeeklyVolumeChartProps {
  data: { weekKey: string; totalMinutes: number }[];
  loading?: boolean;
}

function formatWeekLabel(weekKey: string): string {
  const d = new Date(weekKey + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const WeeklyVolumeChart: React.FC<WeeklyVolumeChartProps> = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl bg-white/5 font-mono text-[10px] uppercase text-white/40">
        Loading…
      </div>
    );
  }

  const hasData = data.some((d) => d.totalMinutes > 0);
  if (!hasData) {
    return (
      <p className="rounded-xl bg-white/5 py-12 text-center font-mono text-[10px] uppercase italic text-white/40">
        Log workouts to see trends
      </p>
    );
  }

  const chartData = data.map((d) => ({
    name: formatWeekLabel(d.weekKey),
    weekKey: d.weekKey,
    minutes: d.totalMinutes,
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis
            dataKey="name"
            tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(0,0,0,0.8)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
            }}
            labelStyle={{ color: 'rgba(255,255,255,0.8)' }}
            formatter={(value: unknown) => [
              `${Number(Array.isArray(value) ? value[0] : value) || 0} min`,
              'Minutes',
            ]}
            labelFormatter={(label) => `Week of ${label}`}
          />
          <Area
            type="monotone"
            dataKey="minutes"
            stroke="#ffbf00"
            fill="#ffbf00"
            fillOpacity={0.2}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default WeeklyVolumeChart;
