const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
function setup({ blocked = false } = {}) {
  const saved = new Map();
  const requests = [];
  const csv = {
    'data/MeanTempCET.csv': 'Date,Value\n2026-10-29,12\n2026-10-30,11.4\n',
    'data/forecast_2026.csv': '2026-10-30,999\n2026-10-31,9.5\n2026-11-01,8.2\n'
  };
  const context = { URL, window: {}, document: { currentScript: { src: 'https://example.github.io/weather-site-k/js/data.js' } },
    localStorage: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => { if (blocked) throw Error('denied'); saved.set(key, value); } },
    fetch: async path => { requests.push(path); return { ok: path in csv, status: 404, text: async () => csv[path] }; }
  };
  vm.runInNewContext(readFileSync(__dirname + '/../public/js/data.js', 'utf8'), context);
  return { api: context.window.WeatherData, requests, saved };
}
test('loads from a project-relative path and excludes observed dates from forecasts', async () => {
  const { api, requests } = setup();
  assert.equal(await api.loadText('data/forecast_2026.csv'), '2026-10-31,9.5\n2026-11-01,8.2\n');
  assert.deepEqual(requests, ['data/forecast_2026.csv', 'data/MeanTempCET.csv']);
});
test('local observations and forecasts reach chart data without changing the CSVs', async () => {
  const { api, saved } = setup();
  api.saveUpdates('cet', { '2026-10-31': 10 });
  api.saveUpdates('for', { '2026-11-01': 7 });
  assert.match(await api.loadText('data/MeanTempCET.csv'), /2026-10-31,10/);
  assert.equal(await api.loadText('data/forecast_2026.csv'), '2026-11-01,7\n');
  assert.ok([...saved.keys()].every(key => key.startsWith('weather-lab:/weather-site-k/')));
});
test('failed saves report an error, and failed data loads can be retried', async () => {
  const { api, requests } = setup({ blocked: true });
  assert.throws(() => api.saveUpdates('cet', {}), /storage is unavailable/);
  await assert.rejects(api.loadText('missing.csv'), /404/);
  await assert.rejects(api.loadText('missing.csv'), /404/);
  assert.equal(requests.length, 2);
});
