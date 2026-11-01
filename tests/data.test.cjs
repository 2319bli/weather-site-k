const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
function setup({ blocked = false, fixtures = {} } = {}) {
  const saved = new Map();
  const requests = [];
  const csv = {
    'data/MeanTempCET.csv': 'Date,Value\n2026-10-29,12\n2026-10-30,11.4\n',
    'data/forecast_2026.csv': '2026-10-30,999\n2026-10-31,9.5\n2026-11-01,8.2\n',
    ...fixtures
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

test('preserves the original day-first and ISO date handling, including leap days', async () => {
  const { api } = setup({ fixtures: {
    'data/MeanTempCET.csv': '\uFEFFDate,Value\r\n01/02/1900,4.1\r\n1900-02-02,5\r\n29/02/1900,999\r\n29/02/2000,6\r\n31/04/2000,999\r\n',
  } });
  assert.equal(await api.loadText('data/MeanTempCET.csv'), 'Date,Value\n1900-02-01,4.1\n1900-02-02,5\n2000-02-29,6\n');
  api.saveUpdates('cet', { '1900-02-01': 7 });
  const edited = await api.loadText('data/MeanTempCET.csv');
  assert.match(edited, /1900-02-01,7/);
  assert.equal(edited.trim().split('\n').length, 4, 'an ISO edit replaces a DMY row instead of duplicating it');
});

test('forecast cutoff compares dates correctly when both files use day-first dates', async () => {
  const { api } = setup({ fixtures: {
    'data/MeanTempCET.csv': 'Date,Value\n30/10/2026,11.4\n',
    'data/forecast_2026.csv': '30/10/2026,999\n31/10/2026,9.5\n01/11/2026,8.2\n',
  } });
  assert.equal(await api.loadText('data/forecast_2026.csv'), '2026-10-31,9.5\n2026-11-01,8.2\n');
});

test('every observation in the actual CET archive survives loading with its original date and value', async () => {
  const source = readFileSync(__dirname + '/../public/data/MeanTempCET.csv', 'utf8');
  const { api } = setup({ fixtures: { 'data/MeanTempCET.csv': source } });
  const expected = source.trim().split(/\r?\n/).slice(1).map(line => {
    const [date, value] = line.split(',');
    const canonical = date.includes('/') ? date.split('/').reverse().join('-') : date;
    return `${canonical},${Number(value)}`;
  }).sort();
  const actual = (await api.loadText('data/MeanTempCET.csv')).trim().split('\n').slice(1).sort();
  assert.equal(expected.length, 93075);
  assert.deepEqual(actual, expected);
});
