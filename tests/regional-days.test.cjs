const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { DAY_DATASETS, monthlyDataset, parseMonthlyArchive, monthlyHistory } = require('../public/sunshine-data.mjs');

test('regional day series keep their full records, published seasons and two-month totals', () => {
  for (const code of Object.keys(DAY_DATASETS)) {
    const { archive, series } = monthlyDataset(code);
    const source = readFileSync(path.join(__dirname, '../public/data', archive), 'utf8');
    const data = parseMonthlyArchive(source);
    const start = series === 'AirFrost' ? 1931 : 1891;
    assert.equal(data.records[0].month, start + '-01');
    const months = new Map(data.records.map(row => [row.month, row.value]));
    for (const line of source.split('\n').filter(line => /^\d{4}/.test(line))) {
      const [year, ...fields] = line.trim().split(/\s+/);
      const count = year === '2026' ? 10 : 12;
      for (let i = 0; i < count; i++) {
        assert.equal(months.get(year + '-' + String(i + 1).padStart(2, '0')), Number(fields[i]));
      }
      if (count === 12 && Number(year) !== start) assert.equal(data.published[year].win, Number(fields[12]));
    }
    const autumn = monthlyHistory(data, 'seasons', 'aut');
    assert.equal(autumn.rows.at(-1).rank, null);
    const matching = monthlyHistory(data, 'seasons', 'aut', true);
    assert.deepEqual(matching.months, [9, 10]);
    assert.equal(matching.rows.at(-1).complete, true);
    const total = Math.round((months.get('2026-09') + months.get('2026-10')) * 10) / 10;
    assert.equal(monthlyHistory(data, 'hex', 'aut').rows.at(-1).value, total);
    assert.equal(matching.rows.at(-1).value, total);
    assert.equal(monthlyHistory(data, 'seasons', 'win').rows.at(-1).value, data.published[2026].win);
  }
});
