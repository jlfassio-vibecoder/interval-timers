/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ChallengeImagesPanel - Grid of Hero + Section 1–5 image slots.
 * Generate (opens modal) and Remove actions per slot.
 */

import React, { useState } from 'react';
import { ImagePlus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ChallengeImageSlot } from '@/lib/supabase/client/challenge-persistence';
import { removeChallengeImage } from '@/lib/supabase/client/challenge-persistence';
import ChallengeImageGenerateModal from './ChallengeImageGenerateModal';

const SLOTS: { value: ChallengeImageSlot; label: string }[] = [
  { value: 'hero', label: 'Hero' },
  { value: '1', label: 'Section 1' },
  { value: '2', label: 'Section 2' },
  { value: '3', label: 'Section 3' },
  { value: '4', label: 'Section 4' },
  { value: '5', label: 'Section 5' },
];

interface ChallengeImagesPanelProps {
  challengeId: string;
  challengeTitle: string;
  challengeTheme?: string;
  heroImageUrl?: string;
  sectionImages?: Record<string, string>;
  onUpdate: () => void;
}

function getSlotImageUrl(
  slot: ChallengeImageSlot,
  heroImageUrl?: string,
  sectionImages?: Record<string, string>
): string | undefined {
  if (slot === 'hero') return heroImageUrl;
  return sectionImages?.[slot];
}

const ChallengeImagesPanel: React.FC<ChallengeImagesPanelProps> = ({
  challengeId,
  challengeTitle,
  challengeTheme,
  heroImageUrl,
  sectionImages,
  onUpdate,
}) => {
  const [generateModalSlot, setGenerateModalSlot] = useState<ChallengeImageSlot | null>(null);
  const [removingSlot, setRemovingSlot] = useState<ChallengeImageSlot | null>(null);

  const handleRemove = async (slot: ChallengeImageSlot) => {
    setRemovingSlot(slot);
    try {
      await removeChallengeImage(challengeId, slot);
      toast.success(`${SLOTS.find((s) => s.value === slot)?.label ?? slot} image removed`);
      onUpdate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove image');
    } finally {
      setRemovingSlot(null);
    }
  };

  return (
    <>
      <div className="rounded-lg border border-white/10 bg-black/20 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-heading text-lg font-bold text-white">Challenge Images</h3>
        </div>
        <p className="mb-4 text-sm text-white/60">
          Hero and section images for the public landing page. Generate with AI or upload manually.
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {SLOTS.map(({ value: slot, label }) => {
            const imageUrl = getSlotImageUrl(slot, heroImageUrl, sectionImages);
            const isRemoving = removingSlot === slot;

            return (
              <div
                key={slot}
                className="flex flex-col overflow-hidden rounded-lg border border-white/10 bg-black/20"
              >
                <div className="relative aspect-video bg-white/5">
                  {imageUrl ? (
                    <img src={imageUrl} alt={label} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-white/40">
                      <ImagePlus className="h-10 w-10" />
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 p-2">
                  <span className="text-sm font-medium text-white">{label}</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setGenerateModalSlot(slot)}
                      className="rounded border border-white/20 bg-white/5 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-white/10"
                    >
                      Generate
                    </button>
                    {imageUrl && (
                      <button
                        type="button"
                        onClick={() => handleRemove(slot)}
                        disabled={isRemoving}
                        className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                      >
                        {isRemoving ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {generateModalSlot && (
        <ChallengeImageGenerateModal
          isOpen
          onClose={() => setGenerateModalSlot(null)}
          challengeId={challengeId}
          challengeTitle={challengeTitle}
          challengeTheme={challengeTheme}
          slot={generateModalSlot}
          onSaved={onUpdate}
        />
      )}
    </>
  );
};

export default ChallengeImagesPanel;
