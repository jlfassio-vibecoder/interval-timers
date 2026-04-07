/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * POST create weekly series + materialized occurrences + invites (P1).
 */

import type { APIRoute } from 'astro';
import { verifyRosterAccessRequest } from '@/lib/supabase/admin/auth';
import { createLiveScheduleSeries } from '@/lib/supabase/admin/trainer-live-scheduled';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { uid: viewerId, role } = await verifyRosterAccessRequest(request, cookies);
    let body: {
      scheduledStartAt?: string;
      scheduledEndAt?: string;
      ianaTimezone?: string;
      horizonWeeks?: number;
      inviteeUserIds?: string[];
      prospectEmails?: string[];
      prospectProgramIds?: string[];
      allowOverlap?: boolean;
    } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const scheduledStartAt =
      typeof body.scheduledStartAt === 'string' ? body.scheduledStartAt.trim() : '';
    const scheduledEndAt =
      typeof body.scheduledEndAt === 'string' ? body.scheduledEndAt.trim() : '';
    const ianaTimezone = typeof body.ianaTimezone === 'string' ? body.ianaTimezone.trim() : '';
    const horizonWeeks =
      typeof body.horizonWeeks === 'number' && Number.isFinite(body.horizonWeeks)
        ? body.horizonWeeks
        : undefined;
    const inviteeUserIds = Array.isArray(body.inviteeUserIds)
      ? body.inviteeUserIds.filter((x): x is string => typeof x === 'string' && x.trim() !== '')
      : [];
    const prospectEmails = Array.isArray(body.prospectEmails)
      ? body.prospectEmails.filter((x): x is string => typeof x === 'string' && x.trim() !== '')
      : [];
    const prospectProgramIds = Array.isArray(body.prospectProgramIds)
      ? body.prospectProgramIds.filter((x): x is string => typeof x === 'string' && x.trim() !== '')
      : [];

    const url = new URL(request.url);
    const publicAppBaseHint = `${url.protocol}//${url.host}`;

    const result = await createLiveScheduleSeries(viewerId, role, {
      scheduledStartAt,
      scheduledEndAt,
      ianaTimezone,
      horizonWeeks,
      inviteeUserIds,
      prospectEmails,
      prospectProgramIds,
      publicAppBaseHint,
      allowOverlap: body.allowOverlap === true,
    });

    if (!result.ok) {
      if ('conflicts' in result && Array.isArray(result.conflicts) && result.conflicts.length > 0) {
        return new Response(JSON.stringify({ error: result.error, conflicts: result.conflicts }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const bad =
        result.error.includes('not on roster') ||
        result.error.includes('required') ||
        result.error.includes('Invalid') ||
        result.error.includes('prospectProgramIds');
      return new Response(JSON.stringify({ error: result.error }), {
        status: bad ? 400 : 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ seriesId: result.seriesId, occurrenceIds: result.occurrenceIds }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
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
      console.error('[trainer/live-schedule/series POST]', error);
    }
    return new Response(JSON.stringify({ error: 'Failed to create series' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
