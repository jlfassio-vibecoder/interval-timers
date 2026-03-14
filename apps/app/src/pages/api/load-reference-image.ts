/**
 * Proxy to load a reference image from a URL (e.g. Supabase Storage) and return base64.
 * Avoids CORS when the client fetches from localhost/production to storage.
 */

import type { APIRoute } from 'astro';

/**
 * Allow HTTPS URLs from the project's Supabase storage (same project as admin).
 * Supabase storage public URLs: https://<project>.supabase.co/storage/v1/object/public/...
 */
function isAllowedUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    if (url.protocol !== 'https:') return false;
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) return false;
    const allowed = new URL(supabaseUrl);
    return url.hostname === allowed.hostname;
  } catch {
    return false;
  }
}

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const imageUrl = url.searchParams.get('url');

  const trimmed = (imageUrl ?? '').trim();
  if (!trimmed) {
    return new Response(JSON.stringify({ error: 'url is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!isAllowedUrl(trimmed)) {
    return new Response(
      JSON.stringify({ error: 'URL must be from project Supabase storage' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    const response = await fetch(trimmed);
    if (!response.ok) {
      return new Response(JSON.stringify({ error: 'Failed to load image' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      return new Response(JSON.stringify({ error: 'URL does not point to an image' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const mime = contentType.split(';')[0].trim() || 'image/png';
    const dataUrl = `data:${mime};base64,${base64}`;

    return new Response(JSON.stringify({ base64: dataUrl }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    console.error('[load-reference-image] Failed to fetch image');
    return new Response(JSON.stringify({ error: 'Failed to fetch image' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
