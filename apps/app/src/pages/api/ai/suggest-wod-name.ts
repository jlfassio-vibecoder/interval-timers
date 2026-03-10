/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * API: suggest a military-themed WOD title.
 * POST body: { level?, description?, genre? }
 * Response: { suggestion: string }
 */

import type { APIRoute } from 'astro';
import type { WODLevel } from '@/types';

const MAX_TITLE_LENGTH = 80;
const WOD_LEVELS: WODLevel[] = ['beginner', 'intermediate', 'advanced'];

interface SuggestWODNameBody {
  level?: WODLevel;
  description?: string;
  genre?: string;
}

async function callAI(options: {
  systemPrompt: string;
  userPrompt: string;
  accessToken: string;
  projectId: string;
  region: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const endpoint = `https://aiplatform.googleapis.com/v1/projects/${options.projectId}/locations/${options.region}/endpoints/openapi/chat/completions`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-ai/deepseek-v3.2-maas',
      messages: [
        { role: 'system', content: options.systemPrompt },
        { role: 'user', content: options.userPrompt },
      ],
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 50,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`AI API error: ${response.status} - ${err.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content ?? data.content;
  if (typeof text !== 'string') {
    throw new Error('Unexpected API response format');
  }
  return text;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    if (!request.body) {
      return new Response(JSON.stringify({ error: 'Request body is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = (await request.json()) as SuggestWODNameBody;
    const level = body.level && WOD_LEVELS.includes(body.level) ? body.level : undefined;
    const description =
      typeof body.description === 'string' ? body.description.slice(0, 500) : undefined;
    const genre = typeof body.genre === 'string' ? body.genre.slice(0, 200) : undefined;

    const projectId =
      import.meta.env.GOOGLE_PROJECT_ID || import.meta.env.PUBLIC_FIREBASE_PROJECT_ID;
    if (!projectId) {
      return new Response(
        JSON.stringify({ error: 'GOOGLE_PROJECT_ID environment variable is not set' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const region = import.meta.env.GOOGLE_LOCATION || 'global';
    let accessToken: string;
    try {
      const { GoogleAuth } = await import('google-auth-library');
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        projectId,
      });
      const client = await auth.getClient();
      const tokenResponse = await client.getAccessToken();
      if (!tokenResponse.token) throw new Error('Failed to get access token');
      accessToken = tokenResponse.token;
    } catch (err) {
      console.error('[suggest-wod-name] Auth error:', err);
      return new Response(
        JSON.stringify({
          error: 'Authentication failed. Run: gcloud auth application-default login',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `You suggest short, memorable titles for workout-of-the-day (WOD) sessions. The site has a military/tactical fitness theme. Output ONLY the title: 2-5 words, no quotes, no "WOD" suffix, no explanation. Examples: Operation Phoenix, Bravo Grinder, Recon Run, Drop Zone, Boot Camp Alpha, Hammer Down, Steel Dawn.`;

    const contextParts: string[] = [];
    if (level) contextParts.push(`Level: ${level}`);
    if (description) contextParts.push(`Workout description: ${description}`);
    if (genre) contextParts.push(`Genre: ${genre}`);
    const userPrompt =
      contextParts.length > 0
        ? `Suggest one military-themed WOD title for this workout.\n\n${contextParts.join('\n')}`
        : 'Suggest one military-themed WOD title for a general fitness workout.';

    const raw = await callAI({
      systemPrompt,
      userPrompt,
      accessToken,
      projectId,
      region,
      temperature: 0.7,
      maxTokens: 50,
    });

    const suggestion = raw.trim().slice(0, MAX_TITLE_LENGTH).trim();
    const finalSuggestion = suggestion || 'Operation WOD';

    return new Response(JSON.stringify({ suggestion: finalSuggestion }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[suggest-wod-name] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to suggest WOD name';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
