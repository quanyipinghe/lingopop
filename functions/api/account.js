// Accounts live in KV as "user:<name>" -> { salt, hash }; each has its own "progress:<name>".
// POST {user, pw}: sign up. Names are case-insensitive ("Bob" and "bob" are the same account).
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const norm = (user) => user.trim().toLowerCase();

async function hash(pw, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256);
}

// Used by progress.js: the account name if x-user / x-pw are right, else null.
export async function authed(request, env) {
  const name = norm(decodeURIComponent(request.headers.get('x-user') ?? ''));
  const acc = name && await env.LP.get('user:' + name, 'json');
  if (!acc) return null;
  const got = await hash(decodeURIComponent(request.headers.get('x-pw') ?? ''), unb64(acc.salt));
  return crypto.subtle.timingSafeEqual(got, unb64(acc.hash)) ? name : null;
}

export async function onRequestPost({ request, env }) {
  let user, pw;
  try { ({ user, pw } = await request.json()); } catch { return new Response('bad json', { status: 400 }); }
  if (typeof user !== 'string' || typeof pw !== 'string' || !norm(user) || user.length > 64 || pw.length < 6 || pw.length > 128) {
    return new Response('need user and a 6-128 char password', { status: 400 });
  }
  const key = 'user:' + norm(user);
  // ponytail: check-then-put isn't atomic; two sign-ups for the same name in the same second could race.
  if (await env.LP.get(key)) return new Response('name taken', { status: 409 });
  const salt = crypto.getRandomValues(new Uint8Array(16));
  await env.LP.put(key, JSON.stringify({ salt: b64(salt), hash: b64(await hash(pw, salt)) }));
  return new Response(null, { status: 201 });
}
