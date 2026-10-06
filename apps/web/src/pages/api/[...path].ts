import type { APIRoute } from 'astro';

// Local same-origin gateway. Only this fixed internal API receives cookies;
// callers cannot choose an upstream or cause automatic redirect following.
export const ALL: APIRoute = async ({ request, url }) => {
  if (!['GET', 'HEAD', 'POST', 'PUT'].includes(request.method)) return new Response(null, { status: 405 });
  const headers = new Headers();
  for (const key of ['cookie', 'content-type', 'origin']) {
    const value = request.headers.get(key);
    if (value) headers.set(key, value);
  }
  try {
    const write = !['GET', 'HEAD'].includes(request.method);
    const reader = write ? request.body?.getReader() : undefined;
    const chunks: Uint8Array[] = [];
    let length = 0;
    if (reader) {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > 2 * 1024 * 1024) { await reader.cancel(); return Response.json({ error: { code: 'BODY_TOO_LARGE', message: 'Import at most 2 MB at a time.' } }, { status: 413 }); }
        chunks.push(value);
      }
    }
    const body = write ? Buffer.concat(chunks) : undefined;
    const target = new URL(process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4310');
    target.pathname = url.pathname;
    target.search = url.search;
    const upstream = await fetch(target, { method: request.method, headers, body,
      redirect: 'manual', signal: AbortSignal.timeout(30000) });
    const outgoing = new Headers({ 'Cache-Control': 'no-store', 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' });
    for (const cookie of upstream.headers.getSetCookie()) outgoing.append('Set-Cookie', cookie);
    return new Response(upstream.body, { status: upstream.status, headers: outgoing });
  } catch { return Response.json({ error: { code: 'API_UNAVAILABLE', message: 'Service unavailable. Try again.' } }, { status: 503 }); }
};
