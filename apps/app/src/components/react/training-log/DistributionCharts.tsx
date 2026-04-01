/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Distribution charts: by type, format, and day of week.
 */

import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Rectangle,
} from 'recharts';

const CHART_COLORS = [
  '#ffbf00',
  '#f59e0b',
  '#eab308',
  '#84cc16',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#a855f7',
];

export interface DistributionChartsProps {
  byType: { type: string; minutes: number }[];
  byFormat: { format: string; minutes: number }[];
  byDayOfWeek: { day: number; dayName: string; minutes: number }[];
}

const TOP_N = 8;

function topNWithOther<T extends { minutes: number }>(
  items: T[],
  labelKey: keyof T,
  n: number
): { name: string; minutes: number }[] {
  const top = items.slice(0, n);
  const rest = items.slice(n);
  const otherMinutes = rest.reduce((sum, i) => sum + i.minutes, 0);
  const result = top.map((i) => ({ name: String(i[labelKey]), minutes: i.minutes }));
  if (otherMinutes > 0) result.push({ name: 'Other', minutes: otherMinutes });
  return result;
}

const DistributionCharts: React.FC<DistributionChartsProps> = ({
  byType,
  byFormat,
  byDayOfWeek,
}) => {
  const typeData = useMemo(() => topNWithOther(byType, 'type', TOP_N), [byType]);
  const formatData = useMemo(() => topNWithOther(byFormat, 'format', TOP_N), [byFormat]);

  const tooltipStyle = {
    backgroundColor: 'rgba(0,0,0,0.8)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
  };

  const renderBarChart = (data: { name: string; minutes: number }[], emptyMessage: string) => {
    const hasData = data.some((d) => d.minutes > 0);
    if (!hasData) {
      return (
        <p className="py-12 text-center font-mono text-[10px] italic text-white/40">
          {emptyMessage}
        </p>
      );
    }
    return (
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.1)"
              horizontal={false}
            />
            <XAxis
              type="number"
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
              tickLine={false}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={80}
              tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
              tickLine={false}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value: unknown) => [`${Number(value) || 0} min`, 'Minutes']}
              labelStyle={{ color: 'rgba(255,255,255,0.8)' }}
            />
            <Bar
              dataKey="minutes"
              radius={[0, 4, 4, 0]}
              shape={(props) => {
                const { x = 0, y = 0, width = 0, height = 0, index = 0 } = props;
                const fill = CHART_COLORS[index % CHART_COLORS.length];
                return (
                  <Rectangle
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    radius={[0, 4, 4, 0]}
                    fill={fill}
                    fillOpacity={0.8}
                  />
                );
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const dayHasData = byDayOfWeek.some((d) => d.minutes > 0);
  const dayChart = dayHasData ? (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={byDayOfWeek} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
          <XAxis
            dataKey="dayName"
            tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: unknown) => [`${Number(value) || 0} min`, 'Minutes']}
            labelStyle={{ color: 'rgba(255,255,255,0.8)' }}
          />
          <Bar dataKey="minutes" radius={[4, 4, 0, 0]} fill="#ffbf00" fillOpacity={0.8} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  ) : (
    <p className="py-12 text-center font-mono text-[10px] italic text-white/40">
      No activity by day yet
    </p>
  );

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h4 className="mb-3 font-mono text-[10px] uppercase tracking-[0.4em] text-white/60">
          Minutes by Type
        </h4>
        {renderBarChart(typeData, 'No minutes by type yet')}
      </div>
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h4 className="mb-3 font-mono text-[10px] uppercase tracking-[0.4em] text-white/60">
          Minutes by Format
        </h4>
        {renderBarChart(formatData, 'No minutes by format yet')}
      </div>
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 md:col-span-2">
        <h4 className="mb-3 font-mono text-[10px] uppercase tracking-[0.4em] text-white/60">
          Activity by Day
        </h4>
        {dayChart}
      </div>
    </div>
  );
};

export default DistributionCharts;
