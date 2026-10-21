// Each account's progress, one KV key per account (see account.js).
import { authed } from './account.js';

export async function onRequest({ request, env }) {
  const name = await authed(request, env);
  if (!name) return new Response('unauthorized', { status: 401 });
  if (request.method === 'GET') {
    return new Response((await env.LP.get('progress:' + name)) ?? '{}', { headers: { 'content-type': 'application/json' } });
  }
  if (request.method === 'PUT') {
    const body = await request.text();
    if (body.length > 65536) return new Response('too large', { status: 413 });
    try { JSON.parse(body); } catch { return new Response('bad json', { status: 400 }); }
    await env.LP.put('progress:' + name, body);
    return new Response(null, { status: 204 });
  }
  return new Response('method not allowed', { status: 405 });
}
