/**
 * Cloudflare Worker: serves the built app (static assets) and proxies the
 * unofficial motogp.com results API under /api/motogp/* — the upstream
 * rejects requests carrying a browser Origin header, so the browser talks to
 * this same-origin route instead. Mirrors the Vite dev proxy and the Pages
 * function (functions/api/motogp/), whichever platform serves the app.
 */

const UPSTREAM = 'https://api.motogp.pulselive.com/motogp/v1';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/motogp/')) {
      return env.ASSETS.fetch(request);
    }
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }
    const path = url.pathname.slice('/api/motogp/'.length);
    // not an open proxy: only the results endpoints the app uses
    if (!path.startsWith('results/')) {
      return new Response('Not found', { status: 404 });
    }
    const upstream = await fetch(`${UPSTREAM}/${path}${url.search}`, {
      headers: { accept: 'application/json' },
      cf: { cacheTtl: 300, cacheEverything: true },
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') ?? 'application/json',
        'cache-control': 'public, max-age=300',
      },
    });
  },
};
