/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * API route for the AI Fitcopilot chat widget. Uses server-side Gemini (no Firebase).
 */

import type { APIRoute } from 'astro';
import { sendAIFitcopilotMessage } from '@/lib/gemini-server';

export const POST: APIRoute = async ({ request }) => {
  const contentType = request.headers.get('Content-Type');
  if (!contentType?.includes('application/json')) {
    return new Response(JSON.stringify({ error: 'Content-Type must be application/json' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    if (!message) {
      return new Response(JSON.stringify({ error: 'message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const text = await sendAIFitcopilotMessage(message);
    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    console.error('[api/chat] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Chat failed', text: 'Neural burnout. Calibration needed.' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
