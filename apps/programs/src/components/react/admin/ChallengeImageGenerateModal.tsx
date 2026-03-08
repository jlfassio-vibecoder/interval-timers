/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ChallengeImageGenerateModal - Generate AI images for challenge Hero or Section slots.
 * Slot picker, optional prompt override, generate + save to challenge.
 */

import React, { useState } from 'react';
import { X, Loader2, Sparkles, Check } from 'lucide-react';
import { toast } from 'sonner';
import type { ChallengeImageSlot } from '@/lib/supabase/client/challenge-persistence';
import {
  generateChallengeImage,
  saveChallengeImage,
} from '@/lib/supabase/client/challenge-persistence';

const SLOTS: { value: ChallengeImageSlot; label: string }[] = [
  { value: 'hero', label: 'Hero' },
  { value: '1', label: 'Section 1' },
  { value: '2', label: 'Section 2' },
  { value: '3', label: 'Section 3' },
  { value: '4', label: 'Section 4' },
  { value: '5', label: 'Section 5' },
];

interface ChallengeImageGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  challengeId: string;
  challengeTitle: string;
  challengeTheme?: string;
  slot: ChallengeImageSlot;
  onSaved: () => void;
}

const ChallengeImageGenerateModal: React.FC<ChallengeImageGenerateModalProps> = ({
  isOpen,
  onClose,
  challengeId,
  challengeTitle,
  challengeTheme,
  slot: initialSlot,
  onSaved,
}) => {
  const [slot, setSlot] = useState<ChallengeImageSlot>(initialSlot);
  const [promptOverride, setPromptOverride] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setGeneratedImage(null);

    try {
      const image = await generateChallengeImage(
        challengeId,
        slot,
        promptOverride.trim() || undefined
      );
      setGeneratedImage(image);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate image');
      toast.error('Failed to generate image');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!generatedImage) return;
    setSaving(true);
    setError(null);

    try {
      await saveChallengeImage(challengeId, slot, generatedImage);
      toast.success('Image saved to challenge');
      onSaved();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save image');
      toast.error('Failed to save image');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setSlot(initialSlot);
    setPromptOverride('');
    setGeneratedImage(null);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/90 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700 p-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-white">
            <Sparkles className="h-5 w-5 text-amber-400" />
            Generate Challenge Image
          </h2>
          <button
            onClick={handleClose}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <p className="text-sm text-slate-400">
            Generate an AI image for <strong className="text-white">{challengeTitle}</strong>
            {challengeTheme && (
              <>
                {' '}
                — theme: <span className="text-slate-300">{challengeTheme}</span>
              </>
            )}
          </p>

          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Image Slot</label>
              <select
                value={slot}
                onChange={(e) => setSlot(e.target.value as ChallengeImageSlot)}
                className="w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-white focus:ring-2 focus:ring-blue-500"
              >
                {SLOTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">
                Prompt Override (Optional)
              </label>
              <textarea
                value={promptOverride}
                onChange={(e) => setPromptOverride(e.target.value)}
                placeholder="Leave blank to auto-generate from challenge title and theme"
                rows={3}
                className="w-full rounded-lg border border-slate-600 bg-slate-900 p-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-900/50 bg-red-900/30 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 py-3 font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  Generate Image
                </>
              )}
            </button>
          </form>

          {generatedImage && (
            <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-900 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-400">
                <Check className="h-4 w-4" />
                Preview — Save to challenge to use
              </div>
              <img
                src={generatedImage}
                alt="Generated preview"
                className="max-h-64 w-full rounded-lg bg-black object-contain"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-slate-700 p-4">
          <button
            onClick={handleClose}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-600"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!generatedImage || saving}
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
                Save to Challenge
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChallengeImageGenerateModal;
