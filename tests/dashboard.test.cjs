const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const dataDirectory = path.join(__dirname, '../public/data');
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test('2026 dashboard matches independently calculated whole-archive figures', async () => {
  const { parseObservations, createArchive, summariseYear } = await import('../public/dashboard-stats.mjs');
  for (const [kind, file, count, value, normal, rankHigh, rankLow, years] of [
    ['cet', 'MeanTempCET.csv', 93075, 12.764026402640264, 11.117876787678768, 1, 255, 255],
    ['ewp', 'PrecipitationEWP.csv', 35002, 680.19, 757.2733333333333, 64, 33, 96]
  ]) {
    const rows = parseObservations(fs.readFileSync(path.join(dataDirectory, file), 'utf8'));
    assert.equal(rows.length, count);
    const result = summariseYear(createArchive(rows, kind), 2026);
    assert.equal(result.latest.iso, '2026-10-30');
    close(result.ytd.value, value); close(result.ytd.normal, normal);
    assert.equal(result.ytd.rankHigh, rankHigh); assert.equal(result.ytd.rankLow, rankLow);
    assert.equal(result.ytd.yearsCompared, years); assert.equal(result.ytd.baselineCount, 30);
    assert.equal(result.ytd.count, 303);
    assert.equal(result.months[9].end, '2026-10-30');
    assert.equal(result.months[9].expected, 30);
    assert.equal(result.months[10], null);
    if (kind === 'ewp') assert.deepEqual(result.dryRun, { days: 23, start: '2026-07-02', end: '2026-07-24' });
  }
});

test('matched dates exclude missing years, preserve ties and do not rank incomplete observations', async () => {
  const { createArchive, comparePeriod } = await import('../public/dashboard-stats.mjs');
  const row = (iso, value) => ({ iso, year: Number(iso.slice(0, 4)), value });
  const rows = [row('1991-01-01', 2), row('1991-01-02', 4), row('1992-01-01', 100), row('2026-01-01', 3), row('2026-01-02', 3)];
  const archive = createArchive(rows, 'cet');
  const compared = comparePeriod(archive, 2026, '2026-01-01', '2026-01-02');
  assert.equal(compared.value, 3); assert.equal(compared.normal, 3);
  assert.equal(compared.baselineCount, 1); assert.equal(compared.yearsCompared, 2);
  assert.equal(compared.tied, true); assert.equal(compared.rankHigh, 1);
  const incomplete = comparePeriod(archive, 2026, '2026-01-01', '2026-01-03');
  assert.equal(incomplete.complete, false); assert.equal(incomplete.rankHigh, null);
  assert.equal(incomplete.delta, null); assert.equal(incomplete.percent, null);
});

test('leap-day comparisons and January windows use matching calendar dates', async () => {
  const { createArchive, comparePeriod, dateSlots } = await import('../public/dashboard-stats.mjs');
  const rows = [
    { iso: '1991-02-28', year: 1991, value: 2 }, { iso: '1991-03-01', year: 1991, value: 4 },
    { iso: '2024-02-28', year: 2024, value: 2 }, { iso: '2024-02-29', year: 2024, value: 500 }, { iso: '2024-03-01', year: 2024, value: 4 }
  ];
  const result = comparePeriod(createArchive(rows, 'ewp'), 2024, '2024-02-28', '2024-03-01');
  assert.equal(result.value, 6); assert.equal(result.normal, 6); assert.equal(result.count, 2);
  assert.deepEqual(dateSlots(2026, '2025-12-31', '2026-01-01'), [{ offset: -1, day: '12-31' }, { offset: 0, day: '01-01' }]);
  const acrossYears = createArchive([
    { iso: '1990-12-31', year: 1990, value: 2 }, { iso: '1991-01-01', year: 1991, value: 4 },
    { iso: '2025-12-31', year: 2025, value: 6 }, { iso: '2026-01-01', year: 2026, value: 8 }
  ], 'cet');
  const january = comparePeriod(acrossYears, 2026, '2025-12-31', '2026-01-01');
  assert.equal(january.value, 7); assert.equal(january.normal, 3); assert.equal(january.rankHigh, 1);
});

test('mixed date parsing, zero values and dry-run gaps are handled explicitly', async () => {
  const { parseObservations, createArchive, comparePeriod, longestDryRun, ordinal } = await import('../public/dashboard-stats.mjs');
  const rows = parseObservations('Date,Value\n01/02/1900,0\n1900-02-02,0.9\n1900-02-04,0\n1900-02-05,1\n');
  assert.equal(rows[0].iso, '1900-02-01');
  assert.deepEqual(longestDryRun(rows), { days: 2, start: '1900-02-01', end: '1900-02-02' });
  assert.throws(() => parseObservations('Date,Value\n2026-02-30,1'), /Invalid date/);
  assert.throws(() => parseObservations('Date,Value\n2026-01-01,1\n01/01/2026,2'), /Duplicate/);
  const zero = parseObservations('Date,Value\n1991-01-01,0\n2026-01-01,0');
  assert.equal(comparePeriod(createArchive(zero, 'ewp'), 2026, '2026-01-01', '2026-01-01').percent, null);
  assert.deepEqual([1,2,3,11,12,13,21].map(ordinal), ['1st','2nd','3rd','11th','12th','13th','21st']);
});
