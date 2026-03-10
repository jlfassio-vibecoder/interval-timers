/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { APIRoute } from 'astro';
import { verifyAdminRequest } from '@/lib/supabase/admin/auth';
import { createProgram } from '@/lib/supabase/admin/program-server';
import type { ProgramTemplate, ProgramConfig, PromptChainMetadata } from '@/types/ai-program';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Verify admin authentication (extracts token from cookies or Authorization header)
    const adminInfo = await verifyAdminRequest(request, cookies);

    // Parse request body
    let body: {
      programData: ProgramTemplate;
      programConfig: ProgramConfig;
      authorId: string;
      chainMetadata?: PromptChainMetadata;
    };
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid request body. Expected JSON.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate required fields
    if (!body.programData || !body.programConfig || !body.authorId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: programData, programConfig, authorId' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate programConfig has required fields
    if (!body.programConfig.targetAudience) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: programConfig.targetAudience' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify authorId matches authenticated user
    if (body.authorId !== adminInfo.uid) {
      return new Response(JSON.stringify({ error: 'Author ID must match authenticated user' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const programId = await createProgram(
      body.authorId,
      body.programData,
      body.programConfig,
      body.chainMetadata
    );

    return new Response(JSON.stringify({ id: programId }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    // Handle authentication/authorization errors
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED' || error.message === 'UNAUTHORIZED') {
        return new Response(JSON.stringify({ error: 'Unauthorized. Admin access required.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Log other errors in development or when error logging is enabled
    if (import.meta.env.DEV || import.meta.env.PUBLIC_ENABLE_ERROR_LOGGING === 'true') {
      console.error('[admin/programs] Error creating program:', error);
    }

    return new Response(JSON.stringify({ error: 'Failed to create program' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
