/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Dynamic sitemap endpoint. Returns XML with static routes plus published
 * exercises and programs from Firestore. Generated pages appear as soon
 * as they are approved/published.
 */

import type { APIRoute } from 'astro';
import { getPublishedExercises } from '@/lib/supabase/public/generated-exercise-service';
import { getPublishedPrograms } from '@/lib/supabase/public/program-service';
import { getPublishedChallenges } from '@/lib/supabase/public/challenge-service';

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function urlEntry(
  base: string,
  path: string,
  options?: { lastmod?: string; changefreq?: string; priority?: string }
): string {
  const loc = base.replace(/\/$/, '') + (path.startsWith('/') ? path : `/${path}`);
  const lastmod = options?.lastmod ? `  <lastmod>${escapeXml(options.lastmod)}</lastmod>\n` : '';
  const changefreq = options?.changefreq
    ? `  <changefreq>${escapeXml(options.changefreq)}</changefreq>\n`
    : '';
  const priority = options?.priority
    ? `  <priority>${escapeXml(options.priority)}</priority>\n`
    : '';
  return `<url>\n  <loc>${escapeXml(loc)}</loc>\n${lastmod}${changefreq}${priority}</url>`;
}

export const GET: APIRoute = async ({ request, site }) => {
  const base = (site?.href && site.href.replace(/\/$/, '')) || new URL(request.url).origin;

  function staticRouteEntries(): string[] {
    const entries: string[] = [];
    entries.push(urlEntry(base, '/', { priority: '1.0', changefreq: 'weekly' }));
    entries.push(urlEntry(base, '/exercises', { priority: '0.9', changefreq: 'weekly' }));
    entries.push(urlEntry(base, '/learn', { priority: '0.9', changefreq: 'weekly' }));
    entries.push(urlEntry(base, '/programs', { priority: '0.9', changefreq: 'weekly' }));
    entries.push(urlEntry(base, '/challenges', { priority: '0.9', changefreq: 'weekly' }));
    entries.push(urlEntry(base, '/workouts', { priority: '0.9', changefreq: 'weekly' }));
    entries.push(urlEntry(base, '/complexes', { priority: '0.9', changefreq: 'weekly' }));
    entries.push(urlEntry(base, '/wod', { priority: '0.9', changefreq: 'weekly' }));
    entries.push(urlEntry(base, '/tabata', { priority: '0.9', changefreq: 'weekly' }));
    return entries;
  }

  try {
    const [exercises, programs, challenges] = await Promise.all([
      getPublishedExercises(),
      getPublishedPrograms(),
      getPublishedChallenges(),
    ]);

    const entries: string[] = [...staticRouteEntries()];

    // Exercise detail and learn (only when deep dive exists)
    for (const ex of exercises) {
      if (ex.slug) {
        entries.push(
          urlEntry(base, `/exercises/${ex.slug}`, {
            lastmod: ex.updatedAt,
            priority: '0.8',
            changefreq: 'monthly',
          })
        );
        if (ex.deepDiveHtmlContent) {
          entries.push(
            urlEntry(base, `/exercises/${ex.slug}/learn`, {
              lastmod: ex.updatedAt,
              priority: '0.7',
              changefreq: 'monthly',
            })
          );
        }
      }
    }

    // Program detail
    for (const prog of programs) {
      entries.push(
        urlEntry(base, `/programs/${prog.id}`, {
          lastmod: prog.updatedAt instanceof Date ? prog.updatedAt.toISOString() : undefined,
          priority: '0.8',
          changefreq: 'monthly',
        })
      );
    }

    // Challenge detail
    for (const ch of challenges) {
      entries.push(
        urlEntry(base, `/challenges/${ch.id}`, {
          lastmod: ch.updatedAt instanceof Date ? ch.updatedAt.toISOString() : undefined,
          priority: '0.8',
          changefreq: 'monthly',
        })
      );
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>`;

    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[sitemap.xml] Error generating sitemap:', message);
    // Fallback: return 200 with static routes so crawlers can still index main pages
    const fallbackXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticRouteEntries().join('\n')}
</urlset>`;
    return new Response(fallbackXml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=60',
      },
    });
  }
};
