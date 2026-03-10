/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Readiness check-in: 1-5 emoji scale for Zone 3 Today Zone.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { getReadiness, saveReadiness } from '@/lib/supabase/client/readiness';

const EMOJIS = ['😴', '😐', '🙂', '💪', '🔥'];
const LABELS = ['Poor', 'Okay', 'Good', 'Strong', 'Fire'];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface ReadinessCheckInProps {
  userId: string;
}

const ReadinessCheckIn: React.FC<ReadinessCheckInProps> = ({ userId }) => {
  const [score, setScore] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const today = todayISO();

  const load = useCallback(async () => {
    const s = await getReadiness(userId, today);
    setScore(s);
  }, [userId, today]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSelect = async (value: number) => {
    setSaving(true);
    try {
      await saveReadiness(userId, today, value);
      setScore(value);
    } catch (e) {
      if (import.meta.env.DEV) console.error('[ReadinessCheckIn]', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4 backdrop-blur-sm">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-white/50">
        How are you feeling today?
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {EMOJIS.map((emoji, i) => {
          const value = i + 1;
          const isSelected = score === value;
          return (
            <button
              key={value}
              type="button"
              disabled={saving}
              onClick={() => handleSelect(value)}
              title={LABELS[i]}
              className={`rounded-full border px-3 py-2 text-lg transition-colors ${
                isSelected
                  ? 'bg-orange-light/20 border-orange-light'
                  : 'border-white/10 bg-white/5 hover:border-white/20'
              }`}
            >
              {emoji}
            </button>
          );
        })}
      </div>
      {score !== null && (
        <p className="mt-2 font-mono text-[10px] text-white/50">Checked in: {LABELS[score - 1]}</p>
      )}
    </div>
  );
};

export default ReadinessCheckIn;
