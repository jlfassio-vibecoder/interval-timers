/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Hook for reference image state: URL input, proxy load, and dataUrl.
 * Used by content generation flows that accept an optional reference image
 * (e.g. Visualization Lab, personalized exercise image).
 */

import { useState } from 'react';

export interface UseReferenceImageOptions {
  /** Base path for loading image from URL. Default: /api/load-reference-image */
  proxyPath?: string;
}

export interface UseReferenceImageReturn {
  referenceImageUrl: string;
  setReferenceImageUrl: (v: string) => void;
  referenceImageData: string | null;
  loadingReference: boolean;
  referenceError: string | null;
  loadReferenceImage: () => Promise<void>;
  loadReferenceFromUrl: (url: string) => Promise<void>;
  setReferenceFromDataUrl: (dataUrl: string) => void;
  clearReferenceImage: () => void;
}

const DEFAULT_PROXY_PATH = '/api/load-reference-image';

export function useReferenceImage(
  options: UseReferenceImageOptions = {}
): UseReferenceImageReturn {
  const { proxyPath = DEFAULT_PROXY_PATH } = options;

  const [referenceImageUrl, setReferenceImageUrl] = useState('');
  const [referenceImageData, setReferenceImageData] = useState<string | null>(null);
  const [loadingReference, setLoadingReference] = useState(false);
  const [referenceError, setReferenceError] = useState<string | null>(null);

  const loadReferenceImage = async () => {
    if (!referenceImageUrl.trim()) {
      setReferenceImageData(null);
      setReferenceError(null);
      return;
    }
    setLoadingReference(true);
    setReferenceError(null);
    try {
      const url =
        proxyPath + (proxyPath.includes('?') ? '&' : '?') + `url=${encodeURIComponent(referenceImageUrl.trim())}`;
      const response = await fetch(url);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load image');
      }
      if (data.base64) {
        setReferenceImageData(data.base64);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      setReferenceError(err instanceof Error ? err.message : 'Failed to load reference image');
      setReferenceImageData(null);
    } finally {
      setLoadingReference(false);
    }
  };

  const clearReferenceImage = () => {
    setReferenceImageUrl('');
    setReferenceImageData(null);
    setReferenceError(null);
  };

  const loadReferenceFromUrl = async (url: string) => {
    if (!url.trim()) return;
    setLoadingReference(true);
    setReferenceError(null);
    try {
      const proxyUrl =
        proxyPath + (proxyPath.includes('?') ? '&' : '?') + `url=${encodeURIComponent(url.trim())}`;
      const response = await fetch(proxyUrl);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load image');
      }
      if (data.base64) {
        setReferenceImageData(data.base64);
        setReferenceImageUrl(url.trim());
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      setReferenceError(err instanceof Error ? err.message : 'Failed to load reference image');
      setReferenceImageData(null);
    } finally {
      setLoadingReference(false);
    }
  };

  const setReferenceFromDataUrl = (dataUrl: string) => {
    setReferenceImageData(dataUrl);
    setReferenceImageUrl('');
    setReferenceError(null);
  };

  return {
    referenceImageUrl,
    setReferenceImageUrl,
    referenceImageData,
    loadingReference,
    referenceError,
    loadReferenceImage,
    loadReferenceFromUrl,
    setReferenceFromDataUrl,
    clearReferenceImage,
  };
}
