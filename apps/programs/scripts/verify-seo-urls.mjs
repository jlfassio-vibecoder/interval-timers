#!/usr/bin/env node

/**
 * Verifies robots.txt and sitemap.xml are implemented correctly and ready for Google indexing.
 * Confirms: reachability, correct content, canonical URLs, and Google sitemap/robots spec compliance.
 * Run: node scripts/verify-seo-urls.mjs
 */

const BASE = 'https://aifitnessguy.com';
const CANONICAL_DOMAIN = 'aifitnessguy.com';

async function check(name, url, checks) {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    const text = await res.text();
    const contentType = res.headers.get('content-type') || '';
    const xRobots = res.headers.get('x-robots-tag') || '';
    const results = [
      { name: 'status 200', ok: res.status === 200 },
      ...checks({ text, contentType, status: res.status, headers: { 'x-robots-tag': xRobots } }),
    ];
    const allOk = results.every((r) => r.ok);
    console.log(allOk ? `✓ ${name}` : `✗ ${name}`);
    results.forEach((r) => console.log(`  ${r.ok ? '✓' : '✗'} ${r.name}`));
    if (!allOk && text.length < 500) console.log('  body preview:', text.slice(0, 200).replace(/\n/g, ' '));
    return allOk;
  } catch (err) {
    console.log(`✗ ${name}`);
    console.log('  ✗ fetch failed:', err.message);
    return false;
  }
}

const robotsOk = await check('robots.txt', `${BASE}/robots.txt`, ({ text, contentType, headers }) => {
  const sitemapMatch = text.match(/Sitemap:\s*(https?:\/\/[^\s]+)/i);
  const sitemapUrl = sitemapMatch ? sitemapMatch[1].trim() : '';
  return [
    { name: 'content-type text/plain', ok: contentType.toLowerCase().includes('text/plain') },
    { name: 'User-agent: * present', ok: /User-agent:\s*\*/i.test(text) },
    { name: 'Allow: / (indexing allowed)', ok: /Allow:\s*\//i.test(text) },
    { name: 'Sitemap URL present', ok: sitemapUrl.length > 0 && sitemapUrl.includes('/sitemap.xml') },
    { name: 'Sitemap uses canonical domain', ok: sitemapUrl.includes(CANONICAL_DOMAIN) },
    { name: 'Sitemap URL is HTTPS', ok: sitemapUrl.startsWith('https://') },
    { name: 'not blocked by X-Robots-Tag', ok: !headers['x-robots-tag']?.toLowerCase().includes('noindex') },
  ];
});

const sitemapOk = await check('sitemap.xml', `${BASE}/sitemap.xml`, ({ text, contentType, headers }) => {
  const locs = [...text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const allHttps = locs.length > 0 && locs.every((u) => u.startsWith('https://'));
  const pathnames = new Set(locs.map((u) => new URL(u).pathname.replace(/\/$/, '') || '/'));
  const keyPaths = ['/', '/exercises', '/programs', '/challenges'];
  const hasKeyPaths = keyPaths.every((p) => pathnames.has(p === '/' ? '/' : p.replace(/\/$/, '')));
  return [
    { name: 'content-type application/xml', ok: contentType.toLowerCase().includes('application/xml') || contentType.toLowerCase().includes('text/xml') },
    { name: 'valid urlset XML', ok: text.includes('<urlset') && text.includes('</urlset>') },
    { name: 'contains loc entries', ok: locs.length > 0 },
    { name: 'all URLs use HTTPS', ok: allHttps },
    { name: 'URLs use canonical domain', ok: locs.every((u) => u.includes(CANONICAL_DOMAIN)) },
    { name: 'key routes present (/, /exercises, /programs, /challenges)', ok: hasKeyPaths },
    { name: 'not blocked by X-Robots-Tag', ok: !headers['x-robots-tag']?.toLowerCase().includes('noindex') },
  ];
});

console.log('\nGoogle indexing readiness:');
if (!robotsOk || !sitemapOk) {
  console.log('\nTip: If Sitemap/URLs use Cloud Run instead of', CANONICAL_DOMAIN + ', set PUBLIC_SITE_URL=https://' + CANONICAL_DOMAIN, 'in production.');
}
const exitCode = robotsOk && sitemapOk ? 0 : 1;
process.exit(exitCode);
