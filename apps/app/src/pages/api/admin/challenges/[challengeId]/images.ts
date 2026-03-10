/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Admin API: Upload challenge image for a slot (Hero or Section 1-5).
 * Accepts data URL, uploads to Supabase Storage, updates challenge row.
 */

import type { APIRoute } from 'astro';
import { verifyAdminRequest } from '@/lib/supabase/admin/auth';
import {
  fetchChallengeImages,
  updateChallengeHeroImage,
  updateChallengeSectionImages,
} from '@/lib/supabase/admin/challenges';
import { uploadBufferToStorage } from '@/lib/supabase/admin/storage-upload';

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const SLOTS = ['hero', '1', '2', '3', '4', '5'] as const;
type Slot = (typeof SLOTS)[number];

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: JSON_HEADERS,
  });
}

function isValidSlot(s: string): s is Slot {
  return SLOTS.includes(s as Slot);
}

/** Parse data URL to buffer and mime type */
function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; contentType: string } | null {
  const match = dataUrl.match(/^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/i);
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const base64 = match[3];
  const buffer = Buffer.from(base64, 'base64');
  const contentType = mime === 'image/jpg' ? 'image/jpeg' : mime;
  return { buffer, contentType };
}

export const POST: APIRoute = async ({ request, params, cookies }) => {
  try {
    await verifyAdminRequest(request, cookies);

    const challengeId = params.challengeId;
    if (!challengeId) {
      return jsonError('Challenge ID is required', 400);
    }

    let body: { slot?: string; imageDataUrl?: string };
    try {
      body = await request.json();
    } catch {
      return jsonError('Invalid JSON body', 400);
    }

    const { slot, imageDataUrl } = body ?? {};
    if (!slot || typeof slot !== 'string' || !isValidSlot(slot)) {
      return jsonError('slot must be one of: hero, 1, 2, 3, 4, 5', 400);
    }
    if (!imageDataUrl || typeof imageDataUrl !== 'string') {
      return jsonError('imageDataUrl is required', 400);
    }

    const parsed = dataUrlToBuffer(imageDataUrl);
    if (!parsed) {
      return jsonError(
        'imageDataUrl must be a valid data URL (data:image/png;base64,... or image/jpeg)',
        400
      );
    }

    const existing = await fetchChallengeImages(challengeId);
    if (!existing) {
      return jsonError('Challenge not found', 404);
    }

    const ext = parsed.contentType.includes('png')
      ? 'png'
      : parsed.contentType.includes('webp')
        ? 'webp'
        : 'jpeg';
    const storagePath = `challenges/${challengeId}/images/${slot}.${ext}`;

    const { downloadUrl } = await uploadBufferToStorage(
      parsed.buffer,
      storagePath,
      parsed.contentType
    );

    if (slot === 'hero') {
      await updateChallengeHeroImage(challengeId, downloadUrl);
    } else {
      const sectionImages = { ...(existing.section_images ?? {}), [slot]: downloadUrl };
      await updateChallengeSectionImages(challengeId, sectionImages);
    }

    return new Response(
      JSON.stringify({
        success: true,
        url: downloadUrl,
        slot,
      }),
      { status: 200, headers: JSON_HEADERS }
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED' || error.message === 'UNAUTHORIZED') {
        return jsonError(error.message, 401);
      }
    }
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[admin/challenges/images]', error);
    }
    return jsonError('Failed to save image', 500);
  }
};

export const DELETE: APIRoute = async ({ request, params, cookies }) => {
  try {
    await verifyAdminRequest(request, cookies);

    const challengeId = params.challengeId;
    if (!challengeId) {
      return jsonError('Challenge ID is required', 400);
    }

    let body: { slot?: string };
    try {
      body = await request.json();
    } catch {
      return jsonError('Invalid JSON body', 400);
    }

    const slot = body?.slot;
    if (!slot || typeof slot !== 'string' || !isValidSlot(slot)) {
      return jsonError('slot must be one of: hero, 1, 2, 3, 4, 5', 400);
    }

    const existing = await fetchChallengeImages(challengeId);
    if (!existing) {
      return jsonError('Challenge not found', 404);
    }

    if (slot === 'hero') {
      await updateChallengeHeroImage(challengeId, null);
    } else {
      const sectionImages = existing.section_images ?? {};
      const { [slot]: _, ...rest } = sectionImages;
      await updateChallengeSectionImages(challengeId, rest);
    }

    return new Response(JSON.stringify({ success: true, slot }), {
      status: 200,
      headers: JSON_HEADERS,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED' || error.message === 'UNAUTHORIZED') {
        return jsonError(error.message, 401);
      }
    }
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[admin/challenges/images DELETE]', error);
    }
    return jsonError('Failed to remove image', 500);
  }
};
