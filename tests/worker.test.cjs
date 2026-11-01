const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const root = path.resolve(__dirname, '..');

test('password verifier uses unique salts and rejects incorrect passwords', async () => {
  const { passwordHash, verifyPassword } = await import('../worker/auth.mjs');
  const first = await passwordHash('test-password-only');
  const second = await passwordHash('test-password-only');
  assert.notEqual(first, second);
  assert.equal(await verifyPassword('test-password-only', first), true);
  assert.equal(await verifyPassword('wrong', first), false);
});

test('server updates preserve historic CSV rows and validate dates', async () => {
  const { csvText, applyUpdates, validateUpdates } = await import('../worker/data.mjs');
  const baseline = require('../worker/baseline.json');
  const state = { observed: { cet: [], ewp: [] }, forecast: {} };
  const forecast = fs.readFileSync(path.join(root, 'public/data/forecast_2026.csv'), 'utf8');
  assert.equal(csvText(forecast, 'for', state, baseline), forecast);
  for (const [dataset, file] of Object.entries({ cet: 'MeanTempCET.csv', ewp: 'PrecipitationEWP.csv' })) {
    const original = fs.readFileSync(path.join(root, 'public/data', file), 'utf8');
    assert.equal(csvText(original, dataset, state, baseline), original);
    const iso = new Date(Date.parse(baseline[dataset]) + 86400000).toISOString().slice(0, 10);
    const updates = validateUpdates([{ iso, value: 1.2, valueText: '1.20' }]);
    applyUpdates(state, baseline, dataset, updates);
    assert.ok(csvText(original, dataset, state, baseline).startsWith(original));
    assert.ok(csvText(original, dataset, state, baseline).endsWith(`${iso},1.20\n`));
    assert.throws(() => applyUpdates(state, baseline, dataset, updates), /First date/);
  }
  assert.throws(() => validateUpdates([{ iso: '2026-02-30', value: 1 }]), /valid ISO/);
  assert.throws(() => validateUpdates([{ iso: '2026-11-01', value: true }]), /numeric/);
  assert.throws(() => validateUpdates([{ iso: '2026-11-01', value: 1, valueText: '=cmd' }]), /value text/);
});

test('Worker protects all admin routes and persists shared updates', async () => {
  const { Miniflare, convertV4MiniflareOptions } = require('miniflare');
  const { build } = require('esbuild');
  const { passwordHash } = await import('../worker/auth.mjs');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'weather-worker-test-'));
  const scriptPath = path.join(temporary, 'worker.mjs');
  await build({ entryPoints: [path.join(root, 'worker/index.mjs')], outfile: scriptPath, bundle: true, format: 'esm', platform: 'neutral', loader: { '.html': 'text' } });
  const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: 'weather-test', modules: true, script: fs.readFileSync(scriptPath, 'utf8'), compatibilityDate: '2026-10-01', compatibilityFlags: ['nodejs_compat'],
    bindings: { ADMIN_PASSWORD_HASH: await passwordHash('integration-test-only'), PUBLIC_SITE_URL: 'https://2319bli.github.io/weather-site-k/' },
    d1Databases: ['DB'],
    serviceBindings: { ASSETS: async request => {
      const filename = new URL(request.url).pathname;
      return new Response(fs.readFileSync(path.join(root, '.worker-assets', filename)));
    } }
  }] }));
  try {
    const db = await mf.getD1Database('DB');
    await db.exec(fs.readFileSync(path.join(root, 'worker/schema.sql'), 'utf8').replace(/\n/g, ' '));
    const origin = 'https://weather.test';
    let session = '';
    const get = url => mf.dispatchFetch(origin + url, { headers: { Cookie: session }, redirect: 'manual' });
    const post = (url, body, extra = {}) => mf.dispatchFetch(origin + url, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: session, ...extra }, body: JSON.stringify(body), redirect: 'manual' });
    for (const route of ['/terminal', '/terminal.html', '/']) assert.equal((await get(route)).status, 303);
    for (const route of ['/api/observed/update', '/api/forecast/update', '/api/extremes/update', '/api/terminal/save', '/api/presets']) assert.equal((await post(route, {})).status, 401);
    assert.equal((await get('/api/terminal/saved?terminal=0')).status, 401);
    assert.equal((await post('/api/login', { password: 'integration-test-only' }, { Origin: 'https://evil.test' })).status, 403);
    assert.equal((await post('/api/login', { password: 'wrong' })).status, 401);
    const login = await post('/api/login', { password: 'integration-test-only' });
    assert.equal(login.status, 200);
    const setCookie = login.headers.get('Set-Cookie');
    for (const flag of ['HttpOnly', 'Secure', 'SameSite=Strict']) assert.ok(setCookie.includes(flag));
    session = setCookie.split(';')[0];
    const page = await get('/terminal.html');
    assert.equal(page.status, 200);
    assert.ok((await page.text()).includes('id="terminal-input"'));
    for (const [dataset, file] of [['hei', 'hottest_days.json'], ['fei', 'coldest_days.json']]) {
      const originalResponse = await get('/data/' + file);
      assert.equal(originalResponse.headers.get('Access-Control-Allow-Origin'), '*');
      const original = await originalResponse.json();
      assert.equal(original.records.length, 152);
      const records = [{ iso: dataset === 'hei' ? '2026-07-01' : '2026-12-30', temperature: dataset === 'hei' ? 40.2 : -25, location: 'Local test station' }];
      const update = { dataset, version: original.version, records };
      assert.equal((await post('/api/extremes/update', update, { Origin: 'https://evil.test' })).status, 403);
      const results = await Promise.all([post('/api/extremes/update', update), post('/api/extremes/update', update)]);
      assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
      const current = await (await get('/data/' + file)).json();
      assert.equal(current.version, original.version + 1);
      assert.equal(current.records.length, original.records.length);
      assert.deepEqual(current.records.slice(0, -1), original.records.slice(0, -1));
      assert.equal(current.records.at(-1).iso, records[0].iso);
      assert.equal((await post('/api/extremes/update', { ...update, version: current.version, records: [{ ...records[0], iso: '2027-02-29' }] })).status, 400);
    }
    assert.equal((await post('/api/terminal/save', { terminal: 1, entries: [{ input: 'dat cet', response: 'saved' }] })).status, 200);
    assert.deepEqual((await (await get('/api/terminal/saved?terminal=1')).json()).entries, [{ input: 'dat cet', response: 'saved' }]);
    assert.equal((await post('/api/presets', { presets: { spring: 'rank table cet year high 10' } })).status, 200);
    assert.equal((await (await get('/api/presets')).json()).presets.spring, 'rank table cet year high 10');
    const baseline = require('../worker/baseline.json');
    const next = new Date(Date.parse(baseline.cet) + 86400000).toISOString().slice(0, 10);
    const updates = [{ iso: next, value: 12.3, valueText: '12.30' }];
    assert.equal((await post('/api/forecast/update', { updates })).status, 200);
    assert.ok((await (await get('/data/forecast_2026.csv')).text()).includes(`${next},12.3`));
    const results = await Promise.all([post('/api/observed/update', { dataset: 'cet', updates }), post('/api/observed/update', { dataset: 'cet', updates })]);
    assert.equal(results.filter(result => result.status === 200).length, 1);
    assert.ok(results.every(result => [200, 400, 409].includes(result.status)));
    const data = await get('/data/MeanTempCET.csv');
    assert.equal(data.headers.get('Access-Control-Allow-Origin'), '*');
    const csv = await data.text();
    assert.ok(csv.startsWith(fs.readFileSync(path.join(root, 'public/data/MeanTempCET.csv'), 'utf8')));
    assert.ok(csv.endsWith(`${next},12.30\n`));
    assert.equal((await (await get('/data/forecast_2026.csv')).text()).includes(next), false);
    assert.equal((await post('/api/forecast/update', { updates })).status, 400);
    const bad = await post('/api/observed/update', { dataset: 'constructor', updates });
    assert.equal(bad.status, 400);
    assert.equal((await post('/api/logout', {})).status, 200);
    assert.equal((await get('/api/presets')).status, 401);
    session = '';
    for (let i = 0; i < 10; i++) assert.equal((await post('/api/login', { password: 'wrong' })).status, 401);
    assert.equal((await post('/api/login', { password: 'wrong' })).status, 429);
  } finally { await mf.dispose(); fs.rmSync(temporary, { recursive: true, force: true }); }
});
