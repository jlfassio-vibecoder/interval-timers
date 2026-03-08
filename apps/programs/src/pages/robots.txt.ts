/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * robots.txt endpoint so crawlers can discover the sitemap and are allowed to index.
 * Required for Google (and other engines) to find /sitemap.xml and index the site.
 */

import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request, site }) => {
  // Prefer configured site for canonical Sitemap URL (proxies/CDNs/alternate hostnames).
  const origin = site?.href ? new URL(site.href).origin : new URL(request.url).origin;
  const sitemapUrl = `${origin}/sitemap.xml`;

  const body = `User-agent: *
Allow: /

Sitemap: ${sitemapUrl}
`;

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
