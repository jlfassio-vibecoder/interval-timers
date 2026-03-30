/**
 * GET/PATCH studio welcome copy (Mission Control). Requires Mission Control session;
 * PATCH requires profiles.studio_id linked to a studios row.
 */

import type { APIRoute } from 'astro';
import { verifyRosterAccessRequest } from '@/lib/supabase/admin/auth';
import {
  getStudioWelcomeContentForEditor,
  getStudioWelcomeContentLimits,
  updateStudioWelcomeContent,
} from '@/lib/supabase/admin/studio-welcome-content';

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    const { uid } = await verifyRosterAccessRequest(request, cookies);
    const payload = await getStudioWelcomeContentForEditor(uid);
    if (!payload.ok) {
      return new Response(JSON.stringify({ error: payload.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(
      JSON.stringify({
        limits: getStudioWelcomeContentLimits(),
        ...(payload.studioLinked
          ? {
              studioLinked: true,
              studioId: payload.studioId,
              slug: payload.slug,
              displayName: payload.displayName,
              stored: payload.stored,
            }
          : { studioLinked: false, stored: payload.stored }),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED' || error.message === 'UNAUTHORIZED') {
        return new Response(
          JSON.stringify({ error: 'Unauthorized. Mission Control access required.' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[trainer/studio/welcome-content GET]', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to load welcome content' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const PATCH: APIRoute = async ({ request, cookies }) => {
  try {
    const { uid } = await verifyRosterAccessRequest(request, cookies);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await updateStudioWelcomeContent(uid, body);
    if (!result.ok) {
      const status = result.code === 'NO_STUDIO' ? 400 : 500;
      return new Response(JSON.stringify({ error: result.message, code: result.code }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, stored: result.stored }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED' || error.message === 'UNAUTHORIZED') {
        return new Response(
          JSON.stringify({ error: 'Unauthorized. Mission Control access required.' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[trainer/studio/welcome-content PATCH]', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to save welcome content' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
