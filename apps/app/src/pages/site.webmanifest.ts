/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Web app manifest endpoint with static icon URLs (bypasses /_image to avoid 500 in production).
 */

import type { APIRoute } from 'astro';
import icon192Url from '../assets/favicon/web-app-manifest-192x192.png?url';
import icon512Url from '../assets/favicon/web-app-manifest-512x512.png?url';

export const GET: APIRoute = async () => {
  const manifest = {
    name: 'AI FITCOPILOT',
    short_name: 'AI FITCOPILOT',
    theme_color: '#0d0500',
    background_color: '#0d0500',
    display: 'standalone',
    start_url: '/interval-timers',
    icons: [
      { src: icon192Url, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: icon512Url, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  };

  return new Response(JSON.stringify(manifest), {
    status: 200,
    headers: { 'Content-Type': 'application/manifest+json' },
  });
};
