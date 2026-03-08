/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Reference image picker: Use last generated, from exercise library, or paste URL.
 * Used by ExerciseImageGenerator (Visualization Lab tab).
 */

import React from 'react';
import { Loader2, X, ImageIcon } from 'lucide-react';
import ExerciseReferenceImagePicker from '@/components/react/admin/ExerciseReferenceImagePicker';

export interface ReferenceImagePickerProps {
  referenceImageData: string | null;
  loadingReference: boolean;
  referenceError: string | null;
  loadReferenceFromUrl: (url: string) => Promise<void>;
  setReferenceFromDataUrl: (dataUrl: string) => void;
  clearReferenceImage: () => void;
  referenceImageUrl: string;
  setReferenceImageUrl: (v: string) => void;
  loadReferenceImage: () => Promise<void>;
  /** Optional; enables "Use last generated" section */
  recentGeneratedDataUrl?: string | null;
}

const ReferenceImagePicker: React.FC<ReferenceImagePickerProps> = ({
  referenceImageData,
  loadingReference,
  referenceError,
  loadReferenceFromUrl,
  setReferenceFromDataUrl,
  clearReferenceImage,
  referenceImageUrl,
  setReferenceImageUrl,
  loadReferenceImage,
  recentGeneratedDataUrl = null,
}) => {
  return (
    <div className="rounded-lg border border-white/10 bg-black/10 p-4">
      <label className="mb-1 block text-sm font-medium text-white/80">
        Reference Image (Optional)
      </label>
      <p className="mb-3 text-xs text-white/50">
        Use a saved image to maintain subject consistency across exercises
      </p>

      {/* 1. Use last generated */}
      {recentGeneratedDataUrl && (
        <div className="mb-3">
          <p className="mb-2 text-xs font-medium text-white/70">Use last generated</p>
          <div className="flex items-center gap-3">
            <img
              src={recentGeneratedDataUrl}
              alt="Last generated"
              className="h-14 w-14 rounded-lg border border-white/20 object-cover"
            />
            <button
              type="button"
              onClick={() => setReferenceFromDataUrl(recentGeneratedDataUrl)}
              disabled={loadingReference}
              className="hover:border-orange-light/30 hover:bg-orange-light/20 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
            >
              Use as reference
            </button>
          </div>
        </div>
      )}

      {/* 2. From exercise library (search, select, pick primary or gallery) */}
      <div className="mb-3">
        <ExerciseReferenceImagePicker
          loadReferenceFromUrl={loadReferenceFromUrl}
          loadingReference={loadingReference}
        />
      </div>

      {/* 3. Or paste URL */}
      <div>
        <p className="mb-2 text-xs text-white/50">Or paste image URL:</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={referenceImageUrl}
            onChange={(e) => setReferenceImageUrl(e.target.value)}
            placeholder="https://firebasestorage.googleapis.com/..."
            className="focus:border-orange-light/50 focus:ring-orange-light/20 flex-1 rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2"
          />
          <button
            type="button"
            onClick={loadReferenceImage}
            disabled={loadingReference || !referenceImageUrl.trim()}
            className="hover:border-orange-light/30 hover:bg-orange-light/20 rounded-lg border border-white/10 bg-black/20 px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
          >
            {loadingReference ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Load'}
          </button>
        </div>
      </div>

      {referenceError && <p className="mt-2 text-xs text-red-400">{referenceError}</p>}

      {/* 4. Loaded preview + Clear */}
      {referenceImageData && (
        <div className="mt-3 flex items-start gap-3">
          <img
            src={referenceImageData}
            alt="Reference"
            className="h-20 w-20 rounded-lg border border-white/20 object-cover"
          />
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1 text-xs text-orange-light">
              <ImageIcon className="h-3 w-3" />
              Reference loaded
            </span>
            <button
              type="button"
              onClick={clearReferenceImage}
              className="flex items-center gap-1 text-xs text-white/60 hover:text-white"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReferenceImagePicker;
