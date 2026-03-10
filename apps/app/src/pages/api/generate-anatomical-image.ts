import type { APIRoute } from 'astro';
import { biomechanicsTextToAnatomicalPrompt, generateInfographicImage } from '@/lib/gemini-server';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

const VALID_SECTION_TYPES = ['chain', 'pivot', 'stabilization'] as const;

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: JSON_HEADERS,
  });
}

export const POST: APIRoute = async ({ request }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const { sectionType, sectionText } = body ?? {};

  if (
    !sectionType ||
    typeof sectionType !== 'string' ||
    !VALID_SECTION_TYPES.includes(sectionType as (typeof VALID_SECTION_TYPES)[number])
  ) {
    return jsonError('sectionType must be one of: chain, pivot, stabilization', 400);
  }

  if (!sectionText || typeof sectionText !== 'string') {
    return jsonError('sectionText is required', 400);
  }

  const text = sectionText.trim();
  if (!text) {
    return jsonError('sectionText cannot be empty', 400);
  }

  try {
    const anatomicalPrompt = await biomechanicsTextToAnatomicalPrompt(
      sectionType as 'chain' | 'pivot' | 'stabilization',
      text
    );

    const imageDataUrl = await generateInfographicImage(anatomicalPrompt);

    return new Response(
      JSON.stringify({
        image: imageDataUrl,
        imagePrompt: anatomicalPrompt,
      }),
      { status: 200, headers: JSON_HEADERS }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'Anatomical image generation failed';
    console.error('[generate-anatomical-image]', message, error);
    return jsonError(message, 500);
  }
};
