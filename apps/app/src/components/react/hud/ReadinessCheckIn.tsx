/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * HUD Daily readiness check-in with sliders, checkboxes, and optional context fields.
 */

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getProgressTextColorClass } from '@/lib/progress-color-ramp';
import {
  getDailyReadinessCheckIn,
  saveDailyReadinessCheckIn,
} from '@/lib/supabase/client/readiness';
import {
  CYCLE_PHASE_OPTIONS,
  DEFAULT_DAILY_CHECKIN,
  LOCATION_OPTIONS,
  MUSCLE_GROUPS,
  addMuscleGroupFocus,
  clampInt,
  getMuscleGroupFocus,
  getSorenessLevel,
  isLastUnlockedGroup,
  removeMuscleGroupFocus,
  removeSorenessArea,
  setMuscleGroupPercentage,
  setSorenessLevel,
  type CyclePhase,
  type DailyCheckInFormState,
  type LocationType,
  type MuscleGroupArea,
} from '@/lib/readiness-daily-check-in';

/** Return YYYY-MM-DD for today in the user's local timezone. */
function localTodayISO(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

function HudDivider() {
  return <div className="border-t border-white/10" />;
}

function sliderPercent(value: number, reverse = false): number {
  const clamped = clampInt(value, 1, 10);
  if (reverse) {
    return ((11 - clamped) / 10) * 100;
  }
  return (clamped / 10) * 100;
}

function progressAccentColor(percent: number): string {
  if (percent < 20) return '#b91c1c'; // red-700
  if (percent < 40) return '#ef4444'; // red-500
  if (percent < 60) return '#f97316'; // orange-500
  if (percent < 80) return '#fbbf24'; // amber-400
  if (percent < 100) return '#6ee7b7'; // emerald-300
  return '#34d399'; // emerald-400
}

export interface ReadinessCheckInProps {
  userId: string;
}

const ReadinessCheckIn: React.FC<ReadinessCheckInProps> = ({ userId }) => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<DailyCheckInFormState>(DEFAULT_DAILY_CHECKIN);
  const [cycleSymptomsText, setCycleSymptomsText] = useState('');
  const today = localTodayISO();
  const energyPercent = sliderPercent(form.energy_level);
  const sleepPercent = sliderPercent(form.sleep_quality);
  const stressPercent = sliderPercent(form.stress_level, true);
  const motivationPercent = sliderPercent(form.motivation_level);
  const energyColorClass = getProgressTextColorClass(energyPercent);
  const sleepColorClass = getProgressTextColorClass(sleepPercent);
  const stressColorClass = getProgressTextColorClass(stressPercent);
  const motivationColorClass = getProgressTextColorClass(motivationPercent);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const data = await getDailyReadinessCheckIn(userId, today);
        if (cancelled) return;
        if (data) {
          setForm({ ...DEFAULT_DAILY_CHECKIN, ...data });
          setCycleSymptomsText((data.cycle_symptoms ?? []).join(', '));
        } else {
          setForm(DEFAULT_DAILY_CHECKIN);
          setCycleSymptomsText('');
        }
      } catch (e) {
        if (import.meta.env.DEV) console.error('[ReadinessCheckIn:load]', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [userId, today]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await saveDailyReadinessCheckIn(userId, today, form);
      toast.success('Check-in saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save check-in');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
        Loading check-in...
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-widest text-white/50">
          Today&apos;s check-in
        </p>
        <p className="text-xs text-white/60">Date: {today}</p>
      </div>

      <div className="mt-4 space-y-4">
        <div className="space-y-2">
          <label className={`block text-sm ${energyColorClass}`}>
            Energy level ({form.energy_level})
          </label>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={form.energy_level}
            onChange={(e) =>
              setForm({ ...form, energy_level: clampInt(Number(e.target.value), 1, 10) })
            }
            className="h-2 w-full cursor-pointer"
            style={{ accentColor: progressAccentColor(energyPercent) }}
          />
        </div>

        <div className="space-y-2">
          <label className={`block text-sm ${sleepColorClass}`}>
            Sleep quality ({form.sleep_quality})
          </label>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={form.sleep_quality}
            onChange={(e) =>
              setForm({ ...form, sleep_quality: clampInt(Number(e.target.value), 1, 10) })
            }
            className="h-2 w-full cursor-pointer"
            style={{ accentColor: progressAccentColor(sleepPercent) }}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm text-white" htmlFor="sleep_hours">
            Sleep hours (optional)
          </label>
          <input
            id="sleep_hours"
            type="number"
            inputMode="decimal"
            placeholder="e.g., 7.5"
            value={form.sleep_hours ?? ''}
            onChange={(e) =>
              setForm({
                ...form,
                sleep_hours: e.target.value === '' ? null : Number(e.target.value),
              })
            }
            className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/35"
          />
        </div>

        <div className="space-y-2">
          <label className={`block text-sm ${stressColorClass}`}>
            Stress level ({form.stress_level})
          </label>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={form.stress_level}
            onChange={(e) =>
              setForm({ ...form, stress_level: clampInt(Number(e.target.value), 1, 10) })
            }
            className="h-2 w-full cursor-pointer"
            style={{ accentColor: progressAccentColor(stressPercent) }}
          />
        </div>

        <div className="space-y-2">
          <label className={`block text-sm ${motivationColorClass}`}>
            Motivation level ({form.motivation_level})
          </label>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={form.motivation_level}
            onChange={(e) =>
              setForm({ ...form, motivation_level: clampInt(Number(e.target.value), 1, 10) })
            }
            className="h-2 w-full cursor-pointer"
            style={{ accentColor: progressAccentColor(motivationPercent) }}
          />
        </div>

        <HudDivider />

        <div className="space-y-3">
          <div>
            <p className="text-sm text-white">Soreness areas (optional)</p>
            <p className="text-xs text-white/50">Select areas and set a level (1-10).</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {MUSCLE_GROUPS.map((area) => {
              const checked = getSorenessLevel(form.soreness_areas, area) !== null;
              const level = getSorenessLevel(form.soreness_areas, area) ?? 4;
              // Same semantics as stress: higher soreness → red, lower → green (reversed ramp).
              const sorenessPercent = sliderPercent(level, true);
              const sorenessColorClass = getProgressTextColorClass(sorenessPercent);
              return (
                <div key={area} className="space-y-3 rounded-md border border-white/10 p-3">
                  <label className="flex items-center gap-2 text-sm text-white">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          soreness_areas: e.target.checked
                            ? setSorenessLevel(form.soreness_areas, area, level)
                            : removeSorenessArea(form.soreness_areas, area),
                        })
                      }
                    />
                    <span className="capitalize">{area}</span>
                  </label>
                  {checked && (
                    <div className="space-y-2">
                      <p className={`text-xs ${sorenessColorClass}`}>Level ({level})</p>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        step={1}
                        value={level}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            soreness_areas: setSorenessLevel(
                              form.soreness_areas,
                              area,
                              clampInt(Number(e.target.value), 1, 10)
                            ),
                          })
                        }
                        className="h-2 w-full cursor-pointer"
                        style={{ accentColor: progressAccentColor(sorenessPercent) }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <HudDivider />

        <div className="space-y-3">
          <div>
            <p className="text-sm text-white">Target muscle groups (optional)</p>
            <p className="text-xs text-white/50">Select groups and adjust focus percentages.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {MUSCLE_GROUPS.map((area) => {
              const focus = getMuscleGroupFocus(form.muscle_group_focus, area);
              const isSelected = focus !== null;
              const percentage = focus?.percentage ?? 0;
              const isLastUnlocked =
                isSelected && isLastUnlockedGroup(form.muscle_group_focus, area);
              const sorenessLevel = getSorenessLevel(form.soreness_areas, area);
              const isSore = sorenessLevel !== null && sorenessLevel >= 7;

              return (
                <div
                  key={area}
                  className={`space-y-3 rounded-md border p-3 ${
                    isSore && isSelected ? 'border-amber-500/50 bg-amber-500/5' : 'border-white/10'
                  }`}
                >
                  <label className="flex items-center gap-2 text-sm text-white">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          muscle_group_focus: e.target.checked
                            ? addMuscleGroupFocus(form.muscle_group_focus, area)
                            : removeMuscleGroupFocus(form.muscle_group_focus, area),
                        })
                      }
                    />
                    <span className="capitalize">{area}</span>
                    {isSore && isSelected && <span className="text-xs text-amber-300">(sore)</span>}
                  </label>
                  {isSelected && (
                    <div className="space-y-2">
                      <p className="text-xs text-white/50">
                        Focus: {percentage}%{isLastUnlocked ? ' (remainder)' : ''}
                      </p>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        disabled={isLastUnlocked}
                        value={percentage}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            muscle_group_focus: setMuscleGroupPercentage(
                              form.muscle_group_focus,
                              area as MuscleGroupArea,
                              Number(e.target.value)
                            ),
                          })
                        }
                        className={`h-2 w-full cursor-pointer ${
                          isLastUnlocked ? 'opacity-50' : ''
                        }`}
                        style={{ accentColor: progressAccentColor(Number(percentage)) }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {form.muscle_group_focus.length > 0 && (
            <p className="text-right text-xs text-white/50">
              Total: {form.muscle_group_focus.reduce((sum, g) => sum + g.percentage, 0)}%
            </p>
          )}
        </div>

        <HudDivider />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-sm text-white">Current location</label>
            <select
              value={form.current_location}
              onChange={(e) =>
                setForm({ ...form, current_location: e.target.value as LocationType })
              }
              className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm text-white"
            >
              {LOCATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-[#0d0500] text-white">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm text-white" htmlFor="available_time">
              Available time (minutes, optional)
            </label>
            <input
              id="available_time"
              type="number"
              inputMode="numeric"
              placeholder="e.g., 45"
              value={form.available_time ?? ''}
              onChange={(e) =>
                setForm({
                  ...form,
                  available_time: e.target.value === '' ? null : Number(e.target.value),
                })
              }
              className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/35"
            />
          </div>
        </div>

        {form.current_location === 'outdoor' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-sm text-white" htmlFor="weather_condition">
                Weather condition (optional)
              </label>
              <input
                id="weather_condition"
                type="text"
                placeholder="e.g., sunny"
                value={form.weather_condition ?? ''}
                onChange={(e) => setForm({ ...form, weather_condition: e.target.value || null })}
                className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/35"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm text-white" htmlFor="temperature">
                Temperature (optional)
              </label>
              <input
                id="temperature"
                type="number"
                inputMode="decimal"
                placeholder="e.g., 72"
                value={form.temperature ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    temperature: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
                className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/35"
              />
            </div>
          </div>
        )}

        <HudDivider />

        <div className="space-y-3">
          <div>
            <p className="text-sm text-white">Cycle tracking (optional)</p>
            <p className="text-xs text-white/50">Set cycle phase and symptoms if applicable.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-sm text-white">Cycle phase</label>
              <select
                value={form.cycle_phase ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    cycle_phase: e.target.value ? (e.target.value as CyclePhase) : null,
                  })
                }
                className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm text-white"
              >
                <option value="" className="bg-[#0d0500] text-white">
                  Select (optional)
                </option>
                {CYCLE_PHASE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-[#0d0500] text-white">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm text-white" htmlFor="cycle_symptoms">
                Cycle symptoms (comma-separated)
              </label>
              <input
                id="cycle_symptoms"
                type="text"
                placeholder="e.g., cramps, fatigue"
                value={cycleSymptomsText}
                onChange={(e) => {
                  const raw = e.target.value;
                  setCycleSymptomsText(raw);
                  const tokens = raw
                    .split(',')
                    .map((t) => t.trim())
                    .filter((t) => t.length > 0);
                  setForm({ ...form, cycle_symptoms: tokens.length > 0 ? tokens : null });
                }}
                onBlur={() => {
                  const tokens = cycleSymptomsText
                    .split(',')
                    .map((t) => t.trim())
                    .filter((t) => t.length > 0);
                  const cleaned = tokens.length > 0 ? tokens.join(', ') : '';
                  setCycleSymptomsText(cleaned);
                  setForm({ ...form, cycle_symptoms: tokens.length > 0 ? tokens : null });
                }}
                className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/35"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="border-orange-500/50 bg-orange-600/25 text-orange-100 hover:bg-orange-600/45 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Saving...' : 'Save check-in'}
          </button>
        </div>
      </div>
    </form>
  );
};

export default ReadinessCheckIn;
