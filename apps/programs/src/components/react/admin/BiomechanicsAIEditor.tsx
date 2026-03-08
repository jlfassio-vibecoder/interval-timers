/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * BiomechanicsAIEditor - AI-powered editor for commonMistakes and Biomechanical Analysis.
 * Generates via Gemini + Google Search, shows diff review, applies accepted sections.
 */

import React, { useState } from 'react';
import { X, Loader2, Send, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { toast } from 'sonner';
import type { GeneratedExercise, ParsedBiomechanics } from '@/types/generated-exercise';
import { parseBiomechanicalPoints } from '@/lib/parse-biomechanics';
import { formatParagraphContent } from '@/lib/sanitize-paragraph-html';

type Focus = 'commonMistakes' | 'biomechanicalAnalysis' | 'all';

interface SectionDiff {
  key: keyof ParsedBiomechanics;
  label: string;
  hasChanged: boolean;
  oldValue: string | string[];
  newValue: string | string[];
  accepted: boolean;
}

interface BiomechanicsAIEditorProps {
  exercise: GeneratedExercise;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: Partial<ParsedBiomechanics>) => Promise<void>;
  focus: Focus;
  getAuthToken: () => Promise<string>;
}

function hasChanged(oldVal: string | string[], newVal: string | string[]): boolean {
  if (Array.isArray(oldVal) && Array.isArray(newVal)) {
    if (oldVal.length !== newVal.length) return true;
    return oldVal.some((v, i) => v !== newVal[i]);
  }
  return (oldVal ?? '') !== (newVal ?? '');
}

function formatValue(value: string | string[]): string {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join('\n• ') : '(empty)';
  }
  return value || '(empty)';
}

const SECTION_KEYS: { key: keyof ParsedBiomechanics; label: string }[] = [
  { key: 'commonMistakes', label: 'Common Mistakes' },
  { key: 'biomechanicalChain', label: 'Biomechanical Chain' },
  { key: 'pivotPoints', label: 'Pivot Points' },
  { key: 'stabilizationNeeds', label: 'Stabilization Needs' },
  { key: 'performanceCues', label: 'Performance Cues' },
];

const ARRAY_SECTION_KEYS: (keyof ParsedBiomechanics)[] = ['commonMistakes', 'performanceCues'];

function defaultForSection(key: keyof ParsedBiomechanics): string | string[] {
  return ARRAY_SECTION_KEYS.includes(key) ? [] : '';
}

const BiomechanicsAIEditor: React.FC<BiomechanicsAIEditorProps> = ({
  exercise,
  isOpen,
  onClose,
  onSave,
  focus,
  getAuthToken,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedNew, setParsedNew] = useState<ParsedBiomechanics | null>(null);
  const [sectionDiffs, setSectionDiffs] = useState<SectionDiff[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const sectionsToShow =
    focus === 'commonMistakes'
      ? SECTION_KEYS.filter((s) => s.key === 'commonMistakes')
      : focus === 'biomechanicalAnalysis'
        ? SECTION_KEYS.filter((s) =>
            ['biomechanicalChain', 'pivotPoints', 'stabilizationNeeds'].includes(s.key)
          )
        : SECTION_KEYS;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setParsedNew(null);
    setSectionDiffs([]);

    try {
      const token = await getAuthToken();
      const response = await fetch(`/api/admin/exercises/${exercise.id}/generate-biomechanics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ focus }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to generate biomechanics');
      }

      const data = await response.json();
      const { biomechanics } = parseBiomechanicalPoints(data.biomechanicalPoints ?? []);
      setParsedNew(biomechanics);

      const bio = exercise.biomechanics ?? ({} as ParsedBiomechanics);
      const diffs: SectionDiff[] = sectionsToShow.map(({ key, label }) => {
        const oldVal = bio[key] ?? defaultForSection(key);
        const newVal = biomechanics[key] ?? defaultForSection(key);
        return {
          key,
          label,
          hasChanged: hasChanged(oldVal, newVal),
          oldValue: oldVal,
          newValue: newVal,
          accepted: true,
        };
      });
      setSectionDiffs(diffs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      toast.error('Failed to generate');
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAccepted = (key: string) => {
    setSectionDiffs((prev) =>
      prev.map((d) => (d.key === key ? { ...d, accepted: !d.accepted } : d))
    );
  };

  const handleSave = async () => {
    if (!parsedNew) return;
    setSaving(true);
    try {
      const updates: Partial<ParsedBiomechanics> = {};
      for (const diff of sectionDiffs) {
        if (diff.accepted && diff.hasChanged) {
          const value = parsedNew[diff.key];
          if (value !== undefined) {
            (updates as Record<string, string | string[]>)[diff.key] = value;
          }
        }
      }
      if (Object.keys(updates).length > 0) {
        await onSave(updates);
        toast.success('Biomechanics updated');
      }
      handleClose();
    } catch (err) {
      toast.error('Failed to save');
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setParsedNew(null);
    setSectionDiffs([]);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  const isPhase2 = parsedNew !== null;
  const title =
    focus === 'commonMistakes'
      ? 'AI Edit: Common Mistakes'
      : focus === 'biomechanicalAnalysis'
        ? 'AI Edit: Biomechanical Analysis'
        : 'AI Edit: Full Biomechanics';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/90 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-800">
        <div className="flex items-center justify-between border-b border-slate-700 p-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-white">
            <Send className="h-5 w-5 text-blue-400" />
            {title}
          </h2>
          <button
            onClick={handleClose}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!isPhase2 ? (
            <form onSubmit={handleGenerate} className="space-y-4">
              <p className="text-sm text-slate-400">
                {focus === 'commonMistakes'
                  ? 'Generate common mistakes using AI with Google Search verification.'
                  : focus === 'biomechanicalAnalysis'
                    ? 'Generate chain, pivot points, and stabilization using AI with Google Search verification.'
                    : 'Generate full biomechanics using AI with Google Search verification.'}{' '}
                Review and accept changes before saving.
              </p>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Exercise</label>
                <p className="rounded-lg border border-slate-600 bg-slate-900 p-3 text-white">
                  {exercise.exerciseName ?? '(unnamed)'}
                </p>
              </div>
              {error && (
                <div className="rounded-lg border border-red-900/50 bg-red-900/30 p-3 text-sm text-red-400">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5" />
                    Generate
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                Review changes. Check/uncheck sections to accept or reject.
              </p>
              <div className="space-y-2">
                {sectionDiffs.map((diff) => (
                  <div
                    key={diff.key}
                    className={`rounded-lg border ${
                      diff.hasChanged
                        ? 'border-amber-900/50 bg-amber-900/10'
                        : 'border-slate-700 bg-slate-900/50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSection(diff.key)}
                      className="flex w-full items-center justify-between p-3 text-left"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={diff.accepted}
                          onChange={() => toggleAccepted(diff.key)}
                          onClick={(e) => e.stopPropagation()}
                          disabled={!diff.hasChanged}
                          className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                        />
                        <span className="font-medium text-white">{diff.label}</span>
                        {diff.hasChanged ? (
                          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400">
                            changed
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-400">
                            unchanged
                          </span>
                        )}
                      </div>
                      {expandedSections.has(diff.key) ? (
                        <ChevronUp className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      )}
                    </button>
                    {expandedSections.has(diff.key) && (
                      <div className="space-y-2 border-t border-slate-700/50 px-3 pb-3 pt-2">
                        <div>
                          <span className="text-xs font-medium uppercase text-red-400">Old:</span>
                          <div
                            className="mt-1 text-sm text-slate-400 [&_p:last-child]:mb-0 [&_p]:mb-0"
                            dangerouslySetInnerHTML={{
                              __html: formatParagraphContent(formatValue(diff.oldValue)),
                            }}
                          />
                        </div>
                        <div>
                          <span className="text-xs font-medium uppercase text-emerald-400">
                            New:
                          </span>
                          <div
                            className="mt-1 text-sm text-slate-300 [&_p:last-child]:mb-0 [&_p]:mb-0"
                            dangerouslySetInnerHTML={{
                              __html: formatParagraphContent(formatValue(diff.newValue)),
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-slate-700 p-4">
          <div className="flex justify-end gap-3">
            <button
              onClick={handleClose}
              className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-600"
            >
              Cancel
            </button>
            {isPhase2 && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Apply Changes
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BiomechanicsAIEditor;
