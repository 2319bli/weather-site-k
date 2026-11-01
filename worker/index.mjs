import terminalHtml from './terminal.html';
import loginHtml from './login.html';
import baseline from './baseline.json';
import { cookie, digest, sessionHash, SESSION_SECONDS, verifyPassword } from './auth.mjs';
import { DATA_FILES, applyUpdates, csvText, forecastRows, validateUpdates } from './data.mjs';
import { EXTREME_FILES, EXTREME_URLS, mergeRecords, parseExtremeCsv, validateRecords } from '../public/extremes.mjs';

const securityHeaders = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'"
};
function response(body, status = 200, headers = {}) {
  return new Response(body, { status, headers: { ...securityHeaders, ...headers } });
}
function json(body, status = 200, headers = {}) {
  return response(JSON.stringify(body), status, { 'Content-Type': 'application/json', ...headers });
}
function redirect(path, headers = {}) { return response(null, 303, { Location: path, ...headers }); }
async function bodyJson(request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw new Error('Use application/json.');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Missing request body.');
  const chunks = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 131072) { await reader.cancel(); throw new Error('Request is too large.'); }
    chunks.push(value);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString());
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new Error('Invalid JSON object.'); }
}
async function readState(env, key) {
  return env.DB.prepare('SELECT value, version FROM state WHERE key = ?').bind(key).first();
}
async function writeState(env, key, value) {
  await env.DB.prepare('INSERT INTO state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, version=state.version+1').bind(key, JSON.stringify(value)).run();
}
async function originalCsv(env, filename) {
  const result = await env.ASSETS.fetch(new Request(`https://assets.invalid/data/${filename}`));
  if (!result.ok) throw new Error('Archive asset is unavailable.');
  return result.text();
}
async function authenticated(request, env, now) {
  if (!env.ADMIN_PASSWORD_HASH) return null;
  const hash = await sessionHash(request, env.ADMIN_PASSWORD_HASH);
  if (!hash) return null;
  const session = await env.DB.prepare('SELECT expires_at FROM sessions WHERE token_hash = ?').bind(hash).first();
  return session?.expires_at > now ? hash : null;
}
async function login(request, env, now) {
  if (!env.ADMIN_PASSWORD_HASH) return json({ error: 'Admin login is not configured.' }, 503);
  const body = await bodyJson(request);
  const limitKey = await digest(request.headers.get('CF-Connecting-IP') || 'local');
  const limit = await env.DB.prepare(`INSERT INTO login_limits(key,attempts,expires_at) VALUES(?,1,?)
    ON CONFLICT(key) DO UPDATE SET
    attempts=CASE WHEN login_limits.expires_at<=? THEN 1 ELSE login_limits.attempts+1 END,
    expires_at=CASE WHEN login_limits.expires_at<=? THEN excluded.expires_at ELSE login_limits.expires_at END
    RETURNING attempts,expires_at`).bind(limitKey, now + 900, now, now).first();
  if (limit.attempts > 10) return json({ error: 'Too many login attempts. Try again in 15 minutes.' }, 429, { 'Retry-After': String(Math.max(1, limit.expires_at - now)) });
  if (!await verifyPassword(body.password, env.ADMIN_PASSWORD_HASH)) return json({ error: 'Incorrect password.' }, 401);
  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');
  const hash = await digest(token + env.ADMIN_PASSWORD_HASH);
  await env.DB.batch([
    env.DB.prepare('INSERT INTO sessions(token_hash,expires_at) VALUES(?,?)').bind(hash, now + SESSION_SECONDS),
    env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now),
    env.DB.prepare('DELETE FROM login_limits WHERE expires_at <= ? OR key = ?').bind(now, limitKey)
  ]);
  return json({ ok: true }, 200, { 'Set-Cookie': cookie(token) });
}
async function updateWeather(request, env, isForecast) {
  const body = await bodyJson(request);
  const updates = validateUpdates(body.updates);
  const dataset = isForecast ? 'for' : body.dataset;
  if (!isForecast && !['cet', 'ewp'].includes(dataset)) return json({ error: 'Dataset must be cet or ewp.' }, 400);
  const before = await readState(env, 'weather');
  const weather = JSON.parse(before.value);
  let removedForecast = 0;
  if (dataset === 'cet') {
    const original = await originalCsv(env, DATA_FILES.for);
    removedForecast = forecastRows(original, weather, baseline).filter(([date]) => date <= updates.at(-1).iso).length;
  }
  applyUpdates(weather, baseline, dataset, updates);
  // One compare-and-swap commits observations and forecast removal together.
  // A second editor must reload instead of overwriting another editor's work.
  const result = await env.DB.prepare("UPDATE state SET value=?,version=version+1 WHERE key='weather' AND version=?")
    .bind(JSON.stringify(weather), before.version).run();
  if (result.meta.changes !== 1) return json({ error: 'Data changed in another session. Reload and retry.' }, 409);
  return json({ dataset, updated: updates.length, updates, removedForecast });
}
function terminalIndex(value) {
  if (!['0', '1', '2'].includes(String(value))) throw new Error('Terminal must be 0, 1 or 2.');
  return Number(value);
}
async function readExtremes(env, dataset) {
  const [original, state] = await Promise.all([
    originalCsv(env, EXTREME_FILES[dataset]), readState(env, `extremes-${dataset}`)
  ]);
  return { records: mergeRecords(parseExtremeCsv(original), state ? JSON.parse(state.value) : {}), version: state?.version || 0 };
}
async function updateExtremes(request, env) {
  const body = await bodyJson(request);
  if (!['hei', 'fei'].includes(body.dataset)) return json({ error: 'Dataset must be hei or fei.' }, 400);
  if (!Number.isSafeInteger(body.version) || body.version < 0) return json({ error: 'Supply the record version shown in the preview.' }, 400);
  const records = validateRecords(body.records);
  const key = `extremes-${body.dataset}`;
  const before = await readState(env, key);
  if (!before || before.version !== body.version) return json({ error: 'Records changed in another session. Run upd again to review the latest records.' }, 409);
  const overrides = JSON.parse(before.value);
  for (const record of records) overrides[record.year] = record;
  const result = await env.DB.prepare('UPDATE state SET value=?,version=version+1 WHERE key=? AND version=?')
    .bind(JSON.stringify(overrides), key, body.version).run();
  if (result.meta.changes !== 1) return json({ error: 'Records changed in another session. Run upd again to review the latest records.' }, 409);
  return json({ updated: records.length, version: body.version + 1 });
}
async function route(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const now = Math.floor(Date.now() / 1000);
  if (request.method === 'POST' && request.headers.get('Origin') !== url.origin) return json({ error: 'Invalid request origin.' }, 403);
  const extreme = Object.keys(EXTREME_URLS).find(key => path === `/data/${EXTREME_URLS[key]}`);
  if (extreme && ['GET', 'HEAD'].includes(request.method)) {
    const data = await readExtremes(env, extreme);
    return response(request.method === 'HEAD' ? null : JSON.stringify(data), 200,
      { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  }
  const dataset = Object.keys(DATA_FILES).find(key => path === `/data/${DATA_FILES[key]}`);
  if (dataset && ['GET', 'HEAD'].includes(request.method)) {
    const [original, state] = await Promise.all([originalCsv(env, DATA_FILES[dataset]), readState(env, 'weather')]);
    return response(request.method === 'HEAD' ? null : csvText(original, dataset, JSON.parse(state.value), baseline), 200,
      { 'Content-Type': 'text/csv; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  }
  if (path === '/api/login' && request.method === 'POST') return login(request, env, now);
  const session = await authenticated(request, env, now);
  if (path === '/login' && request.method === 'GET') return session ? redirect('/terminal.html') : response(loginHtml, 200, { 'Content-Type': 'text/html; charset=utf-8' });
  if (['/', '/terminal', '/terminal.html'].includes(path) && request.method === 'GET') {
    return session ? response(terminalHtml, 200, { 'Content-Type': 'text/html; charset=utf-8' }) : redirect('/login');
  }
  if (path.startsWith('/api/')) {
    if (!session) return json({ error: 'Please sign in again.' }, 401);
    if (path === '/api/logout' && request.method === 'POST') {
      await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(session).run();
      return json({ ok: true }, 200, { 'Set-Cookie': cookie('', 0) });
    }
    if (path === '/api/observed/update' && request.method === 'POST') return updateWeather(request, env, false);
    if (path === '/api/forecast/update' && request.method === 'POST') return updateWeather(request, env, true);
    if (path === '/api/extremes/update' && request.method === 'POST') return updateExtremes(request, env);
    if (path === '/api/terminal/saved' && request.method === 'GET') {
      const row = await readState(env, `terminal-${terminalIndex(url.searchParams.get('terminal'))}`);
      return json({ entries: row ? JSON.parse(row.value) : [] });
    }
    if (path === '/api/terminal/save' && request.method === 'POST') {
      const body = await bodyJson(request);
      const index = terminalIndex(body.terminal);
      if (!Array.isArray(body.entries) || body.entries.length > 5 || body.entries.some(entry => !entry || typeof entry.input !== 'string' || typeof entry.response !== 'string' || entry.input.length > 20000 || entry.response.length > 20000)) return json({ error: 'Supply up to five text entries, each field at most 20000 characters.' }, 400);
      await writeState(env, `terminal-${index}`, body.entries.map(({ input, response }) => ({ input, response })));
      return json({ ok: true });
    }
    if (path === '/api/presets' && request.method === 'GET') {
      const row = await readState(env, 'presets');
      return json({ presets: row ? JSON.parse(row.value) : {} });
    }
    if (path === '/api/presets' && request.method === 'POST') {
      const { presets } = await bodyJson(request);
      if (!presets || Array.isArray(presets) || typeof presets !== 'object' || Object.keys(presets).length > 100 || Object.entries(presets).some(([name, command]) => !/^[A-Za-z0-9_-]{1,32}$/.test(name) || ['__proto__', 'prototype', 'constructor'].includes(name) || typeof command !== 'string' || command.length > 200 || !/^rank\b/i.test(command))) return json({ error: 'Invalid visual presets.' }, 400);
      await writeState(env, 'presets', presets);
      return json({ ok: true });
    }
    return json({ error: 'Unknown API endpoint or method.' }, 404);
  }
  if (request.method === 'GET' && ['/index.html', '/temperature.html', '/ewp.html', '/threshold.html', '/hei.html', '/fei.html'].includes(path)) return redirect(new URL(path.slice(1), env.PUBLIC_SITE_URL).href);
  if (['GET', 'HEAD'].includes(request.method) && ['/site.css', '/theme.css', '/appearance.js', '/logo.svg'].includes(path)) return env.ASSETS.fetch(request);
  return response('Not found', 404);
}
export default {
  async fetch(request, env) {
    try { return await route(request, env); }
    catch (error) {
      // Validation messages are safe to show; infrastructure details stay out of responses.
      if (/D1|SQL|database|Archive asset/i.test(error.message)) return json({ error: 'Storage is unavailable. Please try again.' }, 503);
      return json({ error: error.message || 'Invalid request.' }, 400);
    }
  }
};
