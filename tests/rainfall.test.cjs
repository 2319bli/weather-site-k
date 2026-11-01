const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const A = require('../public/temperature-data.js');
const row = (date, value) => ({ date: new Date(`${date}T00:00:00Z`), value });

function days(start, end, value) {
    const rows = [];
    for (let date = Date.parse(start); date <= Date.parse(end); date += 86400000) {
        rows.push({ date: new Date(date), value });
    }
    return rows;
}

test('rainfall history ranks totals rather than daily means, includes leap day and preserves zero totals', () => {
    const data = A.createArchive([
        ...days('2022-02-01', '2022-02-28', 0),
        ...days('2023-02-01', '2023-02-28', 1),
        ...days('2024-02-01', '2024-02-29', 1),
        ...days('2025-02-01', '2025-02-28', 1),
        row('2026-02-01', 100)
    ]);
    const history = A.history(data, A.period('months', 2), 'total');
    assert.deepEqual(history.map(p => p.value), [0, 28, 29, 28, 100]);
    assert.deepEqual(history.map(p => p.rank), [4, 2, 1, 2, null]);
    assert.deepEqual(history.map(p => p.complete), [true, true, true, true, false]);
    // The original temperature default still calculates/ranks means.
    assert.deepEqual(A.history(data, A.period('months', 2)).map(p => p.value), [0, 1, 1, 1, 100]);
});

test('rainfall daily values distinguish dry days, missing days and wettest record ties', () => {
    const rows = [row('2023-02-28', 0), row('2023-03-01', 12.34), row('2024-02-28', 0), row('2024-02-29', 2.45), row('2024-03-01', 12.34)];
    const data = A.createArchive(rows);
    const daily = A.daily(data, A.period('annual'), [2023, 2024]);
    assert.deepEqual(daily.series[0].observed.slice(58, 62).map(p => p?.value ?? null), [0, null, 12.34, null]);
    assert.deepEqual(daily.series[1].observed.slice(58, 62).map(p => p?.value ?? null), [0, 2.45, 12.34, null]);
    const record = A.heldRecords(data, A.period('months', 3), 2024).find(p => p.bound === 'high');
    assert.equal(record.value, 12.34);
    assert.deepEqual(record.years, [2023, 2024]);
    assert.equal(record.tied, true);
    // A newly loaded server observation replaces an older daily record.
    const updated = A.createArchive([...rows, row('2025-03-01', 13.01)]);
    assert.equal(A.heldRecords(updated, A.period('months', 3), 2024).filter(p => p.bound === 'high').length, 0);
    assert.deepEqual(updated.records.get('03-01').highYears, [2025]);
});

test('rainfall historical periods match independent sums from the full EWP archive', () => {
    const rows = readFileSync(path.join(__dirname, '../public/data/PrecipitationEWP.csv'), 'utf8').trim().split(/\r?\n/).slice(1).map(line => {
        let [date, value] = line.split(',');
        if (date.includes('/')) date = date.split('/').reverse().join('-');
        return row(date, Number(value));
    });
    const data = A.createArchive(rows);
    for (const [view, selection, startMonth, endMonth] of [
        ['annual', null, 0, 12], ['months', 2, 1, 2],
        ['seasons', 'winter', -1, 2], ['hex-seasons', 'pha', 10, 12]
    ]) {
        const stats = A.history(data, A.period(view, selection), 'total');
        for (const stat of stats) {
            const start = Date.UTC(stat.year, startMonth, 1);
            const end = Date.UTC(stat.year, endMonth, 1);
            const actual = rows.filter(p => p.date >= start && p.date < end);
            assert.equal(stat.value, actual.reduce((total, p) => total + p.value, 0));
            assert.equal(stat.expected, (end - start) / 86400000);
            assert.equal(stat.days, actual.length);
            assert.equal(stat.rank === null, actual.length !== stat.expected);
        }
    }
    const winter = A.history(data, A.period('seasons', 'winter'), 'total');
    assert.equal(winter[0].year, 1931);
    assert.equal(winter[0].complete, false, 'the archive starts part-way through winter 1931');
    assert.equal(A.history(data, A.period('annual'), 'total').at(-1).complete, false);
});
