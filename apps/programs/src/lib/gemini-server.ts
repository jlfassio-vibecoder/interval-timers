import { GoogleGenAI } from '@google/genai';

// NOTE: This must only be used server-side to protect the API key
const apiKey = import.meta.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
if (!apiKey) {
  // In development, we might not have the key set yet, but we shouldn't crash until we try to use it
  if (process.env.NODE_ENV !== 'production') {
    console.warn('GEMINI_API_KEY is not set in environment variables');
  }
}

const client = new GoogleGenAI({ apiKey: apiKey || '' });

const GEMINI_API_KEY_MESSAGE =
  'GEMINI_API_KEY is not set. Set it in your deployment environment or server secrets (e.g. host dashboard, CI/CD, or .env) for deep dive and AI features.';

function requireGeminiApiKey(): void {
  if (!apiKey || apiKey.trim() === '') {
    throw new Error(GEMINI_API_KEY_MESSAGE);
  }
}

function isRetryableError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();
  if (lower.includes('503') || lower.includes('unavailable')) return true;
  if (lower.includes('deadline expired') || lower.includes('deadline_exceeded')) return true;
  if (error && typeof error === 'object') {
    const obj = error as { status?: string; code?: number };
    if (obj.status === 'UNAVAILABLE' || obj.code === 503) return true;
  }
  return false;
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;

async function withRetry<T>(fn: () => Promise<T>, logPrefix = '[gemini]'): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const canRetry = attempt < MAX_RETRIES && isRetryableError(error);
      if (!canRetry) throw error;
      // Standard exponential backoff (2s, 4s, 8s). Shorter first delay would risk hammering rate-limited/overloaded Gemini API.
      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      const snippet = error instanceof Error ? error.message : String(error);
      console.warn(
        `${logPrefix} Retryable error (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${delay}ms:`,
        snippet.substring(0, 120)
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

const RESEARCH_SYSTEM_PROMPT = `
Role: "Biomechanical Analyst and Professional Strength Coach."

Tasks:

Use Google Search to verify postural cues, joint angles, and safety for the exercise.

Output 5 biomechanical points: Biomechanical Chain, Pivot Points, Stabilization Needs, Common Mistakes, Performance Cues.

Use Unicode symbols for math and units (e.g. τ, ×, θ, °) and plain text only; do not use LaTeX or $...$ math notation.

Output an IMAGE_PROMPT with technical accuracy, style, complexity, and demographics when given. When form cues, misrenderings to avoid, or domain context are provided, incorporate them strictly into the imagePrompt. When Output Mode is Sequence, output imagePrompts (array of 3 strings) instead of imagePrompt.

Output: STRICT valid JSON with biomechanicalPoints (string array) and either imagePrompt (string) or imagePrompts (array of 3 strings for start/mid/end). Do not include markdown code blocks.
`;

/** Raw grounding chunk from Gemini (structure varies) */
export interface GroundingChunk {
  web?: { uri?: string; title?: string };
  uri?: string;
  title?: string;
}

export interface ResearchResult {
  biomechanicalPoints: string[];
  imagePrompt: string;
  /** When outputMode=sequence: 3 prompts for start, mid, end */
  imagePrompts?: string[];
  searchResults?: GroundingChunk[];
}

export async function researchTopicForPrompt(
  exerciseTopic: string,
  complexityLevel: string = 'intermediate',
  visualStyle: string = 'photorealistic',
  demographics?: string,
  movementPhase?: string,
  bodySide?: string,
  formCuesToEmphasize?: string,
  misrenderingsToAvoid?: string,
  domainContext?: string,
  outputMode?: 'single' | 'sequence',
  bodySideStart?: string,
  bodySideEnd?: string
): Promise<ResearchResult> {
  requireGeminiApiKey();
  const isSequence = outputMode === 'sequence';
  const prompt = `
Exercise Topic: ${exerciseTopic}
Complexity Level: ${complexityLevel}
Visual Style: ${
    visualStyle === 'multiplicity' && !isSequence
      ? 'Multiplicity (Sequence Composite) - Show subject in multiple positions (start, mid, end) in a single frame to demonstrate full range of motion. Use a static background with the subject appearing multiple times to show the path of movement.'
      : isSequence
        ? 'Photorealistic/consistent style - each of 3 images will show ONE phase. Same subject, background, lighting.'
        : visualStyle
  }
${isSequence ? '\nOutput Mode: Sequence - Produce 3 separate image prompts for the START, MID, and END positions of the movement. Same subject, style, and background for all 3. Each prompt describes ONE phase only. Output JSON with biomechanicalPoints (array) and imagePrompts (array of exactly 3 strings: [startPrompt, midPrompt, endPrompt]).' : ''}
${demographics ? `Demographics: ${demographics}` : ''}
${movementPhase && !isSequence ? `Movement Phase: ${movementPhase}` : ''}
${
  isSequence && (bodySideStart || bodySideEnd)
    ? `Start view: ${bodySideStart || 'not specified'}; End view: ${bodySideEnd || 'not specified'}`
    : bodySide
      ? `Body Side: ${bodySide}`
      : ''
}
${formCuesToEmphasize ? `\n\nForm cues to emphasize in the image (MUST be reflected in imagePrompt(s)):\n${formCuesToEmphasize}` : ''}
${misrenderingsToAvoid ? `\n\nCommon misrenderings to AVOID (do NOT describe these in imagePrompt(s)):\n${misrenderingsToAvoid}` : ''}
${domainContext ? `\n\nDomain/style context:\n${domainContext}` : ''}
`;

  try {
    const response = await withRetry(
      () =>
        client.models.generateContent({
          model: 'gemini-3-pro-preview',
          config: {
            systemInstruction: RESEARCH_SYSTEM_PROMPT,
            tools: [{ googleSearch: {} }],
          },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        }),
      '[generate-exercise-image:research]'
    );

    const candidate = response.candidates?.[0];
    const textPart = candidate?.content?.parts?.find((p: { text?: string }) => p.text);
    const text = textPart?.text || '';

    // Robust JSON parsing
    let parsed: { biomechanicalPoints?: string[]; imagePrompt?: string; imagePrompts?: string[] };

    // First try cleaning markdown code blocks (any language hint); extract first block content
    const blockMatch = text.match(/```[\w+-]*\s*\n?([\s\S]*?)```/);
    const cleanedText = blockMatch
      ? blockMatch[1].trim()
      : text.replace(/```json\n?|\n?```/g, '').trim();

    try {
      parsed = JSON.parse(cleanedText);
    } catch {
      // Fallback: try to find JSON object structure
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('Failed to parse JSON. Raw text:', text);
        throw new Error('Failed to parse JSON from research response');
      }
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        console.error('Failed to parse extracted JSON block. Block:', jsonMatch[0]);
        throw new Error('Failed to parse extracted JSON block');
      }
    }

    // Extract search results
    const searchResults = candidate?.groundingMetadata?.groundingChunks;

    const imagePrompts = parsed.imagePrompts;
    const validImagePrompts =
      Array.isArray(imagePrompts) &&
      imagePrompts.length === 3 &&
      imagePrompts.every((s) => typeof s === 'string')
        ? imagePrompts
        : undefined;

    return {
      biomechanicalPoints: parsed.biomechanicalPoints || [],
      imagePrompt: validImagePrompts ? validImagePrompts[0]! : parsed.imagePrompt || '',
      imagePrompts: validImagePrompts,
      searchResults,
    };
  } catch (error) {
    console.error('Error in researchTopicForPrompt:', error);
    throw error;
  }
}

/** Focus for biomechanics-only generation (no image) */
export type BiomechanicsFocus = 'commonMistakes' | 'biomechanicalAnalysis' | 'all';

const BIOMECHANICAL_ANALYSIS_FOCUS_SYSTEM_PROMPT = `
Role: "Biomechanical Analyst and Professional Strength Coach."

Tasks:
Use Google Search to verify postural cues, joint angles, and safety for the exercise.
Output a STRICT valid JSON with biomechanicalPoints: a string array of 5 points.
- Points 1-3 (Biomechanical Chain, Pivot Points, Stabilization Needs) MUST contain full, exercise-specific content. Use Google Search to verify.
- Points 4-5 (Common Mistakes, Performance Cues) may be brief placeholders if not the focus.
Use Unicode symbols for math and units (e.g. τ, ×, θ, °). Plain text only; no LaTeX.
Output: STRICT valid JSON with only biomechanicalPoints (string array). Do not include markdown code blocks.
`;

const BIOMECHANICS_ONLY_SYSTEM_PROMPT = `
Role: "Biomechanical Analyst and Professional Strength Coach."

Tasks:
Use Google Search to verify postural cues, joint angles, and safety for the exercise.
Output 5 biomechanical points: Biomechanical Chain, Pivot Points, Stabilization Needs, Common Mistakes, Performance Cues.
Use Unicode symbols for math and units (e.g. τ, ×, θ, °) and plain text only; do not use LaTeX or $...$ math notation.
Do NOT output imagePrompt. Output only biomechanicalPoints.
Output: STRICT valid JSON with biomechanicalPoints (string array of 5 points). Do not include markdown code blocks.
`;

const COMMON_MISTAKES_FOCUS_SYSTEM_PROMPT = `
Role: "Biomechanical Analyst and Professional Strength Coach."

Tasks:
Use Google Search to research the exercise and identify 3-6 specific common form errors.
Output a STRICT valid JSON with biomechanicalPoints: a string array of 5 points.
- Points 1-3: May be brief placeholders (e.g. "Point 1: Biomechanical Chain - [exercise-specific brief]") if not the focus.
- Point 4: Common Mistakes - MUST contain 3-6 specific, actionable form errors for this exercise. Use bullet or numbered format within the string.
- Point 5: May be a brief placeholder.
Use Unicode symbols for math and units. Plain text only; no LaTeX.
Output: STRICT valid JSON with only biomechanicalPoints (string array). Do not include markdown code blocks.
`;

export interface GenerateBiomechanicsResult {
  biomechanicalPoints: string[];
  searchResults?: GroundingChunk[];
}

export async function generateBiomechanicsForExercise(
  exerciseTopic: string,
  existingBiomechanics?: Partial<{
    biomechanicalChain: string;
    pivotPoints: string;
    stabilizationNeeds: string;
    commonMistakes: string[];
    performanceCues: string[];
  }>,
  focus: BiomechanicsFocus = 'all'
): Promise<GenerateBiomechanicsResult> {
  requireGeminiApiKey();

  const systemPrompt =
    focus === 'commonMistakes'
      ? COMMON_MISTAKES_FOCUS_SYSTEM_PROMPT
      : focus === 'biomechanicalAnalysis'
        ? BIOMECHANICAL_ANALYSIS_FOCUS_SYSTEM_PROMPT
        : BIOMECHANICS_ONLY_SYSTEM_PROMPT;

  let existingContext = '';
  if (existingBiomechanics) {
    if (focus === 'commonMistakes' && (existingBiomechanics.commonMistakes?.length ?? 0) > 0) {
      existingContext = `\nExisting data (review and improve if incorrect, or use as reference):\nCommon Mistakes: ${existingBiomechanics.commonMistakes?.join('; ') || 'none'}`;
    } else if (focus === 'biomechanicalAnalysis') {
      const chain = existingBiomechanics.biomechanicalChain?.trim();
      const pivot = existingBiomechanics.pivotPoints?.trim();
      const stab = existingBiomechanics.stabilizationNeeds?.trim();
      if (chain || pivot || stab) {
        existingContext = '\nExisting data (review and improve if incorrect, or use as reference):';
        if (chain) existingContext += `\nBiomechanical Chain: ${chain}`;
        if (pivot) existingContext += `\nPivot Points: ${pivot}`;
        if (stab) existingContext += `\nStabilization Needs: ${stab}`;
      }
    }
  }

  const prompt = `
Exercise Topic: ${exerciseTopic}
${existingContext}
`;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-3-pro-preview',
      config: {
        systemInstruction: systemPrompt,
        tools: [{ googleSearch: {} }],
      },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const candidate = response.candidates?.[0];
    const textPart = candidate?.content?.parts?.find((p: { text?: string }) => p.text);
    const text = textPart?.text || '';

    let parsed: { biomechanicalPoints?: string[] };
    const blockMatch = text.match(/```[\w+-]*\s*\n?([\s\S]*?)```/);
    const cleanedText = blockMatch
      ? blockMatch[1].trim()
      : text.replace(/```json\n?|\n?```/g, '').trim();

    try {
      parsed = JSON.parse(cleanedText);
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('Failed to parse JSON. Raw text:', text);
        throw new Error('Failed to parse JSON from biomechanics response');
      }
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        throw new Error('Failed to parse extracted JSON block');
      }
    }

    const searchResults = candidate?.groundingMetadata?.groundingChunks;

    return {
      biomechanicalPoints: parsed.biomechanicalPoints || [],
      searchResults,
    };
  } catch (error) {
    console.error('Error in generateBiomechanicsForExercise:', error);
    throw error;
  }
}

const DEEP_DIVE_SYSTEM_PROMPT = `
You are an Elite Strength Coach and Web Developer. Your goal is to output a single, beautiful, responsive HTML5 file (with embedded Tailwind CSS via CDN) that serves as the 'Ultimate Guide' for a specific exercise.

Structure:
1. One <h1> — the exercise name as the main page title (no other <h1> on the page).
2. Hero Section (use the provided image URL)
3. Biomechanics (Deep dive: Moment arms, Force vectors, Kinetic chain)
4. Muscle Map (Description of primary/secondary movers and stabilizers)
5. Execution Protocol — use an <h2> or <h3> titled exactly "Execution Protocol" and a single <ol> with one <li> per step (numbered execution steps). This section is used by the Daily Warm-Up timer.
6. Common Mistakes table

Headings: Use a single <h1> for the exercise name; use <h2> for major sections and <h3> for subsections; keep a logical hierarchy (do not skip levels, e.g. no h4 without h3).

Tone: Clinical, educational, and encouraging.
Content: Deeply research the specific biomechanics for the given exercise name.
Images: Embed the provided image URL in the Hero Section.

Use Unicode symbols for math and units (e.g. τ, ×, θ, °) and plain text only; do not use LaTeX or $...$ math notation.

Do not include a Sources or References section; sources are added by the application.

Output: Return ONLY the raw HTML string. Do not include markdown code blocks.
`;

export async function generateExerciseHtml(
  exerciseName: string,
  imageUrl: string,
  biomechanics?: {
    biomechanicalChain: string;
    pivotPoints: string;
    stabilizationNeeds: string;
  },
  /** URL for the "Go Back" button (default: /exercises). */
  backLinkHref: string = '/exercises'
): Promise<string> {
  requireGeminiApiKey();
  const prompt = `
Generate a Deep Dive HTML page for the exercise: "${exerciseName}".
The first heading must be a single <h1> containing the exercise name.

Image URL: ${imageUrl}

Biomechanics Context:
- Chain: ${biomechanics?.biomechanicalChain || 'N/A'}
- Pivots: ${biomechanics?.pivotPoints || 'N/A'}
- Stabilization: ${biomechanics?.stabilizationNeeds || 'N/A'}

Ensure the HTML is fully self-contained with Tailwind CSS (via CDN) and uses a high-contrast, clean typography design (Inter/Roboto).
Include a "Go Back" button that links to "${backLinkHref}".
`;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-3-pro-preview',
      config: {
        systemInstruction: DEEP_DIVE_SYSTEM_PROMPT,
        responseMimeType: 'text/plain',
      },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const candidate = response.candidates?.[0];
    const textPart = candidate?.content?.parts?.find((p: { text?: string }) => p.text);
    let html = textPart?.text || '';

    // Clean up markdown if present
    html = html.replace(/```html\n?|\n?```/g, '').trim();

    return html;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in generateExerciseHtml:', message);
    throw error;
  }
}

export type AnatomicalSectionType = 'chain' | 'pivot' | 'stabilization';

const ANATOMICAL_PROMPT_SYSTEM = `You are an expert at creating image prompts for anatomical and biomechanical diagrams.

Given biomechanics text describing a section (Kinetic Chain, Pivot Points, or Stabilization Needs), output a single imagePrompt string optimized for an anatomical/diagram image.

Requirements:
- The prompt must describe an anatomical illustration or schematic diagram, NOT a photorealistic exercise photo.
- Include: kinetic chain, joints, pivot points, muscle groups, or stabilization structures as appropriate.
- Style: educational, clear, schematic/anatomical diagram. Use terms like "anatomical diagram", "schematic illustration", "labeled diagram".
- Output ONLY the imagePrompt string. No JSON, no markdown, no preamble.`;

export async function biomechanicsTextToAnatomicalPrompt(
  sectionType: AnatomicalSectionType,
  sectionText: string
): Promise<string> {
  requireGeminiApiKey();
  const sectionLabels = {
    chain: 'Biomechanical Chain / Kinetic Chain',
    pivot: 'Pivot Points',
    stabilization: 'Stabilization Needs',
  };
  const prompt = `
Section type: ${sectionLabels[sectionType]}
Biomechanics text:
---
${sectionText.trim()}
---

Create an image prompt for an anatomical diagram that visually represents the content above. Output only the prompt, nothing else.`;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-3-pro-preview',
      config: { systemInstruction: ANATOMICAL_PROMPT_SYSTEM },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const candidate = response.candidates?.[0];
    const textPart = candidate?.content?.parts?.find((p: { text?: string }) => p.text);
    const text = (textPart?.text || '').trim();
    if (!text) throw new Error('Empty response from anatomical prompt model');
    return text;
  } catch (error) {
    console.error('Error in biomechanicsTextToAnatomicalPrompt:', error);
    throw error;
  }
}

const VIDEO_PROMPT_SYSTEM = `You are an expert at creating video prompts for exercise demonstration videos.

Given an exercise name, performance cues, biomechanics (chain, pivot points, stabilization), and common mistakes, output a single promptText string optimized for Runway image-to-video generation.

Requirements:
- State the plane of motion (frontal, sagittal, or transverse) when relevant. For shoulder/arm movements like arm circles, use frontal plane; motion occurs at the glenohumeral joint, torso stays fixed.
- Describe what SHOULD happen: "A fitness professional performing [exercise] with slow, controlled tempo. High stability, realistic joint articulation, 4k."
- Emphasize full range of motion, kinetic chain, and key joints.
- Common mistakes to AVOID: The output prompt must explicitly ensure the motion does NOT exhibit the listed form errors (e.g., "No torso rotation", "No trunk rotation", "No swaying").
- Keep under 500 characters. No JSON, no markdown, no preamble.
- Output ONLY the prompt string.`;

export async function buildExerciseVideoPrompt(
  exerciseName: string,
  performanceCues: string[],
  biomechanics: {
    biomechanicalChain?: string;
    pivotPoints?: string;
    stabilizationNeeds?: string;
    commonMistakes?: string[];
  }
): Promise<string> {
  requireGeminiApiKey();
  const cuesText =
    performanceCues.length > 0 ? performanceCues.join('. ') : 'Full range of motion.';
  const chainText = biomechanics.biomechanicalChain ?? '';
  const pivotText = biomechanics.pivotPoints ?? '';
  const stabText = biomechanics.stabilizationNeeds ?? '';
  const mistakes = biomechanics.commonMistakes ?? [];
  const mistakesText = mistakes.length > 0 ? mistakes.join('; ') : 'None specified';

  const prompt = `
Exercise: ${exerciseName}
Performance cues: ${cuesText}
Biomechanical chain: ${chainText}
Pivot points: ${pivotText}
Stabilization needs: ${stabText}
Common mistakes to AVOID in the motion (do NOT produce these): ${mistakesText}

Create a video prompt for Runway that describes the exercise motion. Include plane of motion when relevant (e.g., frontal plane for arm circles). Explicitly state what must NOT happen based on common mistakes. Output only the prompt string.`;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-3-pro-preview',
      config: { systemInstruction: VIDEO_PROMPT_SYSTEM },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const candidate = response.candidates?.[0];
    const textPart = candidate?.content?.parts?.find((p: { text?: string }) => p.text);
    const text = (textPart?.text || '').trim();
    if (!text) throw new Error('Empty response from video prompt model');
    return text.slice(0, 1000);
  } catch (error) {
    console.error('Error in buildExerciseVideoPrompt:', error);
    throw error;
  }
}

/** Motion brush area: [x1, y1, x2, y2] normalized 0-1, and motion intensity */
export interface MotionBrushArea {
  area: [number, number, number, number];
  horizontal: number;
  vertical: number;
}

/**
 * Derive motion_brush areas from biomechanics to isolate limb movement.
 * Maps pivot points and chain data to approximate body-region coordinates.
 */
export function deriveMotionBrushFromBiomechanics(biomechanics: {
  pivotPoints?: string;
  biomechanicalChain?: string;
}): MotionBrushArea[] {
  const pivot = (biomechanics.pivotPoints ?? '').toLowerCase();
  const chain = (biomechanics.biomechanicalChain ?? '').toLowerCase();

  if (
    pivot.includes('hip') ||
    pivot.includes('knee') ||
    chain.includes('leg') ||
    chain.includes('lower')
  ) {
    return [{ area: [0.35, 0.45, 0.65, 0.95], horizontal: 0, vertical: 7 }];
  }
  if (
    pivot.includes('shoulder') ||
    pivot.includes('elbow') ||
    chain.includes('arm') ||
    chain.includes('upper')
  ) {
    return [{ area: [0.2, 0.15, 0.8, 0.55], horizontal: 2, vertical: 6 }];
  }
  return [{ area: [0.25, 0.2, 0.75, 0.9], horizontal: 1, vertical: 6 }];
}

/** Content part type for multimodal requests */
interface ContentPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

export interface GenerateInfographicImageOptions {
  /** When true, the reference shows a different phase; output MUST be a different pose (sequence mode). */
  requireDifferentPose?: boolean;
}

export async function generateInfographicImage(
  imagePrompt: string,
  referenceImageBase64?: string,
  options?: GenerateInfographicImageOptions
): Promise<string> {
  try {
    // Build content parts - include reference image if provided
    const parts: ContentPart[] = [];

    if (referenceImageBase64) {
      // Strip data URL prefix if present to get raw base64 (subtype may include + or -, e.g. image/svg+xml, image/x-icon)
      const base64Data = referenceImageBase64.replace(/^data:image\/[^;]+;base64,/, '');
      // Detect mime type from data URL or default to png
      const mimeMatch = referenceImageBase64.match(/^data:(image\/[^;]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';

      // Add reference image first
      parts.push({
        inlineData: {
          mimeType,
          data: base64Data,
        },
      });

      const requireDifferentPose = options?.requireDifferentPose;
      const referenceInstruction = requireDifferentPose
        ? `This reference image shows ONE phase of an exercise. Generate a NEW image with a DIFFERENT body position and pose as described below. Use the reference ONLY for subject appearance (same person: face, body type, skin tone, hair, clothing). The POSE and BODY POSITION must be DISTINCTLY different from the reference. Do NOT replicate the reference pose. The prompt below specifies the exact position/phase you must show:`
        : `Using the person/subject from this reference image, generate a new exercise image. Maintain the same subject appearance (face, body type, skin tone, hair, clothing style).`;

      // Add prompt with reference instruction
      parts.push({
        text: `${referenceInstruction} ${imagePrompt}`,
      });
    } else {
      // No reference image - just use the prompt
      parts.push({ text: imagePrompt });
    }

    const response = await withRetry(
      () =>
        client.models.generateContent({
          model: 'gemini-3-pro-image-preview',
          config: {
            responseModalities: ['IMAGE'],
          },
          contents: [{ role: 'user', parts }],
        }),
      '[generate-exercise-image:image]'
    );

    const candidate = response.candidates?.[0];
    const imagePart = candidate?.content?.parts?.find(
      (p: { inlineData?: { mimeType?: string; data?: string } }) => p.inlineData
    );

    if (imagePart && imagePart.inlineData) {
      return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
    }

    throw new Error('No image data found in response');
  } catch (error) {
    console.error('Error in generateInfographicImage:', error);
    throw error;
  }
}

/** System instruction for the AI Fitcopilot chat (AIChat widget). */
const AI_FITCOPILOT_SYSTEM_PROMPT = `You are 'AI FITCOPILOT', the AI assistant for personal trainers. You help trainers design programs, prescribe exercises, and scale workouts for their clients.

Role: AI assistant for personal trainers designing programs and prescribing exercises.
Tone: Professional, clinical, supportive. Use emojis sparingly (💪, 🔥, ⚡) when it fits.

Focus on: program design, exercise selection, form cues, periodization, client scaling, and evidence-based recommendations.

Keep responses short (under 50 words) and high-energy. The user is a personal trainer—answer in that context (e.g. "prescribe", "assign to clients", "scale for").`;

/**
 * Send a message to the AI Fitcopilot chat. Used by the AIChat widget via /api/chat.
 * Server-side only; uses GEMINI_API_KEY.
 */
export async function sendAIFitcopilotMessage(userMessage: string): Promise<string> {
  requireGeminiApiKey();
  try {
    const response = await client.models.generateContent({
      model: 'gemini-2.0-flash',
      config: {
        systemInstruction: AI_FITCOPILOT_SYSTEM_PROMPT,
      },
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
    });
    const candidate = response.candidates?.[0];
    const textPart = candidate?.content?.parts?.find((p: { text?: string }) => p.text);
    const text = textPart?.text?.trim();
    return text || 'Connection dropped. Checking metabolic load...';
  } catch (error) {
    if (import.meta.env?.DEV || process.env.NODE_ENV !== 'production') {
      console.error('Gemini chat error:', error);
    }
    return 'Neural burnout. Calibration needed.';
  }
}
