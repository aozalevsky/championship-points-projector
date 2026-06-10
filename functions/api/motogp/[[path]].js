/**
 * Cloudflare Pages Function: proxy for the unofficial motogp.com results API.
 * The upstream rejects requests carrying a browser Origin header, so the
 * browser calls /api/motogp/* (same origin) and this function forwards the
 * request server-side. Mirrors the local Vite dev proxy in vite.config.ts.
 */

const UPSTREAM = 'https://api.motogp.pulselive.com/motogp/v1';

export async function onRequest({ request, params }) {
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }
  const path = Array.isArray(params.path) ? params.path.join('/') : (params.path ?? '');
  // not an open proxy: only the results endpoints the app uses
  if (!path.startsWith('results/')) {
    return new Response('Not found', { status: 404 });
  }
  const search = new URL(request.url).search;
  const upstream = await fetch(`${UPSTREAM}/${path}${search}`, {
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
}
