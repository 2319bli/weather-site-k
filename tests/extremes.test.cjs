const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

for (const [dataset, filename] of [['hei', 'hottest_days.csv'], ['fei', 'coldest_days.csv']]) {
  test(`${dataset}: every bar matches the original Python export`, async () => {
    const { parseExtremeCsv, buildIndex } = await import('../public/extremes.mjs');
    const records = parseExtremeCsv(fs.readFileSync(path.join(root, 'public/data', filename), 'utf8'));
    const original = require(`./fixtures/${dataset}-original.json`);
    const actual = buildIndex(records, dataset);
    assert.equal(records.length, 152);
    assert.equal(actual.firstYear, 1875);
    assert.equal(actual.lastYear, 2026);
    assert.deepEqual(actual.trace.x, original.x);
    actual.trace.y.forEach((value, i) => assert.ok(Math.abs(value - original.y[i]) < 1e-8, `day ${original.x[i]}`));
    const top = actual.top[0];
    assert.equal(top.date, dataset === 'hei' ? '01 July' : '30 December');
    assert.equal(top.value, dataset === 'hei' ? 47.4 : 64.4);
  });
}

test('annual replacements recalculate bars, rankings, hover records and year range', async () => {
  const { parseExtremeCsv, mergeRecords, buildIndex, validateRecords } = await import('../public/extremes.mjs');
  for (const [dataset, filename, iso, temperature, expected] of [
    ['hei', 'hottest_days.csv', '2026-07-01', 40.2, 60.6],
    ['fei', 'coldest_days.csv', '2026-12-30', -25, 81.4]
  ]) {
    const records = parseExtremeCsv(fs.readFileSync(path.join(root, 'public/data', filename), 'utf8'));
    const replacement = validateRecords([{ iso, temperature, location: '<img src=x onerror=alert(1)>' }])[0];
    const merged = mergeRecords(records, { 2026: replacement });
    assert.equal(merged.length, records.length);
    const actual = buildIndex(merged, dataset);
    assert.equal(actual.top[0].value, expected);
    assert.ok(actual.top[0].hover.includes('2026:'));
    assert.ok(actual.top[0].hover.includes('&lt;img'));
    assert.ok(!actual.top[0].hover.includes('<img'));
    const extended = mergeRecords(merged, { 2027: { ...replacement, year: 2027, iso: iso.replace('2026', '2027') } });
    assert.equal(buildIndex(extended, dataset).lastYear, 2027);
  }
});

test('annual dates, leap days, negative excess and quoted locations retain their meaning', async () => {
  const { validateRecords, parseExtremeCsv, buildIndex } = await import('../public/extremes.mjs');
  const record = { iso: '2028-02-29', temperature: -20, location: 'Station, "North"' };
  const leap = buildIndex([record], 'fei');
  assert.equal(leap.top[0].date, '29 February');
  assert.equal(leap.trace.y[leap.trace.x.indexOf(424.5)], 12);
  const coldCsv = 'Year,Date,Temperature,Location\r\n2028,29/02,-20,"Station, ""North"""\r\n';
  assert.equal(parseExtremeCsv(coldCsv)[0].location, record.location);
  const negative = buildIndex([{ iso: '1879-07-29', temperature: 26.8, location: 'Hillington' }], 'hei');
  assert.equal(negative.top[0].value, -0.2);
  for (const bad of [{ ...record, iso: '2027-02-29' }, { ...record, temperature: '20' }, { ...record, temperature: 100 }, { ...record, location: '' }]) {
    assert.throws(() => validateRecords([bad]));
  }
  assert.throws(() => validateRecords([record, { ...record, iso: '2028-03-01' }]), /one annual record/);
});
