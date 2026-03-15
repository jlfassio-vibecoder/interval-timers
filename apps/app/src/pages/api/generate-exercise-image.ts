import type { APIRoute } from 'astro';
import { researchTopicForPrompt, generateInfographicImage } from '@/lib/gemini-server';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** Return a JSON error response so the client never gets empty or non-JSON body (avoids "Unexpected end of JSON input"). */
function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: JSON_HEADERS,
  });
}

/** Log a structured error for easier filtering in production (e.g. Cloud Run). */
function logStructured(
  step: 'research' | 'image',
  message: string,
  error: unknown,
  code?: string
): void {
  const payload: {
    step: 'research' | 'image';
    message: string;
    code?: string;
    errorName?: string;
    stack?: string;
  } = { step, message, code };
  if (error instanceof Error) {
    payload.errorName = error.name;
    payload.stack = error.stack ?? undefined;
  }
  console.error('[generate-exercise-image]', JSON.stringify(payload), error);
}

function isRateLimitError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();
  if (lower.includes('429') || lower.includes('rate limit') || lower.includes('resource exhausted'))
    return true;
  if (error && typeof error === 'object') {
    const obj = error as { status?: string; code?: number };
    if (obj.status === 'RESOURCE_EXHAUSTED' || obj.code === 429) return true;
  }
  return false;
}

export const POST: APIRoute = async ({ request }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const {
    exerciseTopic,
    complexityLevel = 'intermediate',
    visualStyle = 'photorealistic',
    outputMode = 'single',
    demographics,
    movementPhase,
    bodySide,
    bodySideStart,
    bodySideEnd,
    formCuesToEmphasize,
    misrenderingsToAvoid,
    domainContext,
    referenceImage,
    researchOnly,
    generateFromPrompts,
    imagePrompt: imagePromptOverride,
    imagePrompts: imagePromptsOverride,
    biomechanicalPoints: biomechanicalPointsOverride,
    searchResults: searchResultsOverride,
  } = body ?? {};

  const isGenerateFromPrompts = generateFromPrompts === true;
  const isResearchOnly = researchOnly === true && !isGenerateFromPrompts;

  if (isGenerateFromPrompts) {
    // Generate-from-prompts mode: skip research, require prompts and research data
    const mode = outputMode === 'sequence' ? 'sequence' : 'single';
    const prompts =
      mode === 'sequence' ? (imagePromptsOverride as string[] | undefined) : undefined;
    const singlePrompt =
      mode === 'single' ? (imagePromptOverride as string | undefined) : undefined;

    const validPrompts =
      mode === 'sequence'
        ? Array.isArray(prompts) &&
          prompts.length === 3 &&
          prompts.every((p) => typeof p === 'string')
        : typeof singlePrompt === 'string' && singlePrompt.trim().length > 0;

    const points = biomechanicalPointsOverride as string[] | undefined;
    const validPoints = Array.isArray(points) && points.length > 0;

    if (!validPrompts) {
      return jsonError(
        mode === 'sequence'
          ? 'imagePrompts (array of 3 strings) is required for generateFromPrompts in sequence mode'
          : 'imagePrompt (string) is required for generateFromPrompts in single mode',
        400
      );
    }
    if (!validPoints) {
      return jsonError('biomechanicalPoints is required for generateFromPrompts', 400);
    }

    const refImg = typeof referenceImage === 'string' ? referenceImage : undefined;
    const searchResults = (searchResultsOverride ?? []) as Awaited<
      ReturnType<typeof researchTopicForPrompt>
    >['searchResults'];

    try {
      if (mode === 'sequence' && prompts) {
        const image1 = await generateInfographicImage(prompts[0], refImg);
        const image2 = await generateInfographicImage(prompts[1], image1, {
          requireDifferentPose: true,
        });
        const image3 = await generateInfographicImage(prompts[2], image2, {
          requireDifferentPose: true,
        });
        const imageUrls = [image1, image2, image3];
        return new Response(
          JSON.stringify({
            image: imageUrls[0],
            images: imageUrls,
            biomechanicalPoints: points,
            searchResults,
            imagePrompt: prompts[0],
            imagePrompts: prompts,
          }),
          { status: 200, headers: JSON_HEADERS }
        );
      }

      const single = (mode === 'single' ? singlePrompt : prompts?.[0]) as string;
      const imageDataUrl = await generateInfographicImage(single, refImg);
      return new Response(
        JSON.stringify({
          image: imageDataUrl,
          biomechanicalPoints: points,
          searchResults,
          imagePrompt: single,
        }),
        { status: 200, headers: JSON_HEADERS }
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : 'Image generation failed';
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code?: string }).code)
          : undefined;
      logStructured('image', message, error, code);
      if (isRateLimitError(error)) {
        return jsonError('Rate limit exceeded. Please wait a few minutes and try again.', 429);
      }
      return jsonError(message, 500);
    }
  }

  if (!exerciseTopic || typeof exerciseTopic !== 'string') {
    return jsonError('exerciseTopic is required', 400);
  }

  // Explicit env check in production so we return 503 instead of failing later
  const isProduction = process.env.NODE_ENV === 'production';
  const hasKey = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '');
  if (isProduction && !hasKey) {
    return jsonError('Image generation is not configured', 503);
  }

  let researchResult: Awaited<ReturnType<typeof researchTopicForPrompt>>;

  try {
    // Stage 1: Research
    researchResult = await researchTopicForPrompt(
      exerciseTopic,
      String(complexityLevel ?? 'intermediate'),
      String(visualStyle ?? 'photorealistic'),
      demographics != null ? String(demographics) : undefined,
      movementPhase != null ? String(movementPhase) : undefined,
      bodySide != null ? String(bodySide) : undefined,
      formCuesToEmphasize != null && String(formCuesToEmphasize).trim()
        ? String(formCuesToEmphasize).trim()
        : undefined,
      misrenderingsToAvoid != null && String(misrenderingsToAvoid).trim()
        ? String(misrenderingsToAvoid).trim()
        : undefined,
      domainContext != null && String(domainContext).trim()
        ? String(domainContext).trim()
        : undefined,
      outputMode === 'sequence' ? 'sequence' : 'single',
      bodySideStart != null ? String(bodySideStart) : undefined,
      bodySideEnd != null ? String(bodySideEnd) : undefined
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'Research failed';
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: string }).code)
        : undefined;
    logStructured('research', message, error, code);
    if (isRateLimitError(error)) {
      return jsonError('Rate limit exceeded. Please wait a few minutes and try again.', 429);
    }
    return jsonError(message, 500);
  }

  if (isResearchOnly) {
    return new Response(
      JSON.stringify({
        biomechanicalPoints: researchResult.biomechanicalPoints,
        searchResults: researchResult.searchResults,
        imagePrompt: researchResult.imagePrompt,
        ...(researchResult.imagePrompts &&
          researchResult.imagePrompts.length === 3 && {
            imagePrompts: researchResult.imagePrompts,
          }),
      }),
      { status: 200, headers: JSON_HEADERS }
    );
  }

  const refImg = typeof referenceImage === 'string' ? referenceImage : undefined;

  try {
    // Stage 2: Image Generation (with optional reference image for subject consistency)
    if (researchResult.imagePrompts && researchResult.imagePrompts.length === 3) {
      // Generate image 1 (with user reference if provided)
      const image1 = await generateInfographicImage(researchResult.imagePrompts[0], refImg);
      // Use image 1 as reference for images 2 and 3; require different poses
      const image2 = await generateInfographicImage(researchResult.imagePrompts[1], image1, {
        requireDifferentPose: true,
      });
      const image3 = await generateInfographicImage(researchResult.imagePrompts[2], image2, {
        requireDifferentPose: true,
      });
      const imageUrls = [image1, image2, image3];
      return new Response(
        JSON.stringify({
          image: imageUrls[0],
          images: imageUrls,
          biomechanicalPoints: researchResult.biomechanicalPoints,
          searchResults: researchResult.searchResults,
          imagePrompt: researchResult.imagePrompts[0],
          imagePrompts: researchResult.imagePrompts,
        }),
        { status: 200, headers: JSON_HEADERS }
      );
    }

    const imageDataUrl = await generateInfographicImage(researchResult.imagePrompt, refImg);

    return new Response(
      JSON.stringify({
        image: imageDataUrl,
        biomechanicalPoints: researchResult.biomechanicalPoints,
        searchResults: researchResult.searchResults,
        imagePrompt: researchResult.imagePrompt,
      }),
      { status: 200, headers: JSON_HEADERS }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'Image generation failed';
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: string }).code)
        : undefined;
    logStructured('image', message, error, code);
    if (isRateLimitError(error)) {
      return jsonError('Rate limit exceeded. Please wait a few minutes and try again.', 429);
    }
    return jsonError(message, 500);
  }
};
