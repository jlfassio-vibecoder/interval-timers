/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Admin API: Generate challenge image via Gemini.
 * Returns data URL; client persists via images API.
 */

import type { APIRoute } from 'astro';
import { verifyAdminRequest } from '@/lib/supabase/admin/auth';
import { fetchChallengeMetadata } from '@/lib/supabase/admin/challenges';
import { generateInfographicImage } from '@/lib/gemini-server';

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

function buildPrompt(title: string, theme: string | undefined, slot: Slot): string {
  const base = `Fitness challenge: ${title}`;
  const themePart = theme ? `, theme: ${theme}` : '';
  if (slot === 'hero') {
    return `Standalone hero image for a fitness challenge. ${base}${themePart}. Professional, motivational, high-energy fitness imagery. Photorealistic, clean composition. Show only the image content: no navbar, no navigation bar, no website UI, no header, no menu, no buttons. Pure image only, not a webpage or screenshot.`;
  }
  return `Section ${slot} image for a fitness challenge. ${base}${themePart}. Professional, motivational fitness imagery. Photorealistic, clean composition. Standalone image only: no navbar, no website UI, no header or menu. Pure image content.`;
}

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    await verifyAdminRequest(request, cookies);

    let body: { challengeId?: string; slot?: string; promptOverride?: string };
    try {
      body = await request.json();
    } catch {
      return jsonError('Invalid JSON body', 400);
    }

    const { challengeId, slot, promptOverride } = body ?? {};
    if (!challengeId || typeof challengeId !== 'string') {
      return jsonError('challengeId is required', 400);
    }
    if (!slot || typeof slot !== 'string' || !isValidSlot(slot)) {
      return jsonError('slot must be one of: hero, 1, 2, 3, 4, 5', 400);
    }

    let metadata;
    try {
      metadata = await fetchChallengeMetadata(challengeId);
    } catch {
      return jsonError('Challenge not found', 404);
    }
    const title = metadata.title ?? 'Fitness Challenge';
    const theme = metadata.theme;

    const prompt =
      typeof promptOverride === 'string' && promptOverride.trim()
        ? promptOverride.trim()
        : buildPrompt(title, theme, slot as Slot);

    const imageDataUrl = await generateInfographicImage(prompt);

    return new Response(JSON.stringify({ image: imageDataUrl }), {
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
      console.error('[admin/challenges/generate-image]', error);
    }
    return jsonError('Image generation failed', 500);
  }
};
