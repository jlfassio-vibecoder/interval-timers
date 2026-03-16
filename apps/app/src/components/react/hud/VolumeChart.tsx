/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Zone 4: Volume trend chart (sets per week). Uses Recharts.
 */

import React, { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { useAppContext } from '@/contexts/AppContext';
import { getVolumeByWeek, type WeeklyVolume } from '@/lib/supabase/client/progress-analytics';

export interface VolumeChartProps {
  isPaid: boolean;
}

const VolumeChart: React.FC<VolumeChartProps> = ({ isPaid }) => {
  const { user } = useAppContext();
  const [data, setData] = useState<WeeklyVolume[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isPaid || !user?.uid) {
      setLoading(false);
      setData([]);
      return;
    }
    setLoading(true);
    getVolumeByWeek(user.uid, 8)
      .then(setData)
      .finally(() => setLoading(false));
  }, [isPaid, user?.uid]);

  if (!isPaid) return null;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl bg-white/5 font-mono text-[10px] uppercase text-white/40">
        Loading…
      </div>
    );
  }

  const hasData = data.some((d) => d.setsCount > 0);
  if (!hasData) {
    return (
      <p className="rounded-xl bg-white/5 py-12 text-center font-mono text-[10px] uppercase italic text-white/40">
        Log your first workout to see trends
      </p>
    );
  }

  const chartData = data.map((d) => ({
    name: d.weekKey.replace('-W', ' W'),
    sets: d.setsCount,
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
            formatter={(value: unknown) =>
              [`${Number(Array.isArray(value) ? value[0] : value) || 0} sets`, 'Sets']}
            labelFormatter={(label) => `Week ${label}`}
          />
          <Area
            type="monotone"
            dataKey="sets"
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

export default VolumeChart;
