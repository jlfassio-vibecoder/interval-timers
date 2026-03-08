/**
 * Proxy to load a reference image from a URL (e.g. Firebase Storage) and return base64.
 * Avoids CORS when the client fetches from localhost/production to Firebase Storage.
 */

import type { APIRoute } from 'astro';

/** Project Firebase Storage bucket (host or path segment). */
const ALLOWED_BUCKET = 'ai-fitness-guy-26523278-3e978.firebasestorage.app';
const FIREBASE_STORAGE_API_HOST = 'firebasestorage.googleapis.com';

/**
 * Allow only HTTPS URLs that point to this project's Firebase Storage bucket.
 * Supports both:
 * - Direct bucket host: https://<bucket>/
 * - API host with bucket in path: https://firebasestorage.googleapis.com/v0/b/<bucket>/o/...
 */
function isAllowedUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    if (url.protocol !== 'https:') return false;

    if (url.hostname === ALLOWED_BUCKET) return true;
    if (url.hostname === FIREBASE_STORAGE_API_HOST) {
      const path = url.pathname;
      const bucketSegment = `/v0/b/${ALLOWED_BUCKET}/`;
      return path.startsWith(bucketSegment) || path === `/v0/b/${ALLOWED_BUCKET}`;
    }
    return false;
  } catch {
    return false;
  }
}

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const imageUrl = url.searchParams.get('url');

  if (!imageUrl || !imageUrl.trim()) {
    return new Response(JSON.stringify({ error: 'url is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!isAllowedUrl(imageUrl)) {
    return new Response(JSON.stringify({ error: 'URL must be from project Firebase Storage' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const response = await fetch(imageUrl);
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
    // Log fixed string only; do not log error details to avoid leaking request URLs or paths in server logs.
    console.error('[load-reference-image] Failed to fetch image');
    return new Response(JSON.stringify({ error: 'Failed to fetch image' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
