const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const A = require('../public/temperature-data.js');
const row = (iso, value) => ({ date: new Date(`${iso}T00:00:00Z`), value });
function days(start, end, value) {
    const rows = [];
    for (let time = Date.parse(start); time <= Date.parse(end); time += 86400000) rows.push({ date: new Date(time), value });
    return rows;
}

test('year-to-date compares calendar dates, excluding leap day and later observations', () => {
    const data = A.createArchive([
        ...days('2024-01-01', '2024-03-01', 1), row('2024-02-29', 999), row('2024-12-31', 999),
        ...days('2025-01-01', '2025-03-01', 2), ...days('2026-01-01', '2026-03-01', 3)
    ]);
    const period = A.period('annual');
    const mean = A.historyToDate(data, period);
    assert.equal(mean.referenceYear, 2026);
    assert.equal(mean.start, '2026-01-01');
    assert.equal(mean.end, '2026-03-01');
    assert.equal(mean.expected, 60);
    assert.deepEqual(mean.rows.map(p => p.value), [1, 2, 3]);
    assert.deepEqual(mean.rows.map(p => p.days), [60, 60, 60]);
    assert.deepEqual(mean.rows.map(p => p.rank), [3, 2, 1]);
    assert.deepEqual(A.historyToDate(data, period, 'total').rows.map(p => p.value), [60, 120, 180]);
    assert.ok(A.history(data, period).every(p => !p.complete), 'full periods remain incomplete');
});

test('each dataset uses its own observation cutoff; zero values count and gaps stay unranked', () => {
    const cet = A.createArchive([
        ...days('2024-01-01', '2024-01-03', 1), row('2025-01-01', 20), row('2025-01-03', 20),
        ...days('2026-01-01', '2026-01-03', 2)
    ]);
    const rain = A.createArchive([
        ...days('2025-01-01', '2025-01-03', 0), ...days('2026-01-01', '2026-01-02', 0)
    ]);
    const temperature = A.historyToDate(cet, A.period('annual'));
    const rainfall = A.historyToDate(rain, A.period('annual'), 'total');
    assert.equal(temperature.end, '2026-01-03');
    assert.deepEqual(temperature.rows.map(p => p.rank), [2, null, 1]);
    assert.equal(temperature.rows[1].days, 2);
    assert.equal(temperature.rows[1].expected, 3);
    assert.equal(rainfall.end, '2026-01-02');
    assert.deepEqual(rainfall.rows.map(p => p.value), [0, 0]);
    assert.deepEqual(rainfall.rows.map(p => p.rank), [1, 1]);
    assert.ok(rainfall.rows.every(p => p.complete));
});

test('winter comparisons use the preceding December, including December-only winters', () => {
    const period = A.period('seasons', 'winter');
    const data = A.createArchive([
        ...days('2024-12-01', '2025-02-28', 1), ...days('2025-12-01', '2026-01-15', 2)
    ]);
    const winter = A.historyToDate(data, period, 'total');
    assert.equal(winter.start, '2025-12-01');
    assert.equal(winter.end, '2026-01-15');
    assert.equal(winter.expected, 46);
    assert.deepEqual(winter.rows.map(p => p.value), [46, 92]);
    assert.equal(winter.rows[0].windowStart, '2024-12-01');
    assert.equal(winter.rows[0].windowEnd, '2025-01-15');
    const december = A.historyToDate(A.createArchive([...data.rows.map(p => row(p.iso, p.value)), ...days('2026-12-01', '2026-12-10', 3)]), period, 'total');
    assert.equal(december.referenceYear, 2027);
    assert.equal(december.start, '2026-12-01');
    assert.equal(december.end, '2026-12-10');
    assert.deepEqual(december.rows.map(p => p.value), [10, 20, 30]);
});

test('months, seasons and hex-seasons clip to their own bounds and future periods are empty', () => {
    const data = A.createArchive([...days('2025-01-01', '2025-12-31', 1), ...days('2026-01-01', '2026-10-15', 2)]);
    for (const [view, selection, expected, start, end] of [
        ['months', 10, 15, '2026-10-01', '2026-10-15'],
        ['months', 9, 30, '2026-09-01', '2026-09-30'],
        ['seasons', 'autumn', 45, '2026-09-01', '2026-10-15'],
        ['hex-seasons', 'aut', 45, '2026-09-01', '2026-10-15']
    ]) {
        const result = A.historyToDate(data, A.period(view, selection), 'total');
        assert.equal(result.expected, expected);
        assert.equal(result.start, start);
        assert.equal(result.end, end);
        assert.deepEqual(result.rows.map(p => p.value), [expected, expected * 2]);
    }
    for (const [view, selection] of [['months', 12], ['hex-seasons', 'pha']]) {
        const result = A.historyToDate(data, A.period(view, selection));
        assert.equal(result.referenceYear, 2026);
        assert.equal(result.expected, 0);
        assert.deepEqual(result.rows, []);
    }
});

test('a wholly missing reference period is not treated as zero rainfall', () => {
    const data = A.createArchive([...days('2025-07-01', '2025-07-31', 0), row('2026-08-01', 2)]);
    const result = A.historyToDate(data, A.period('months', 7), 'total');
    const current = result.rows.find(p => p.year === 2026);
    assert.equal(current.value, null);
    assert.equal(current.rank, null);
    assert.equal(current.days, 0);
    assert.equal(current.expected, 31);
    assert.equal(result.rows[0].value, 0);
    assert.equal(result.rows[0].rank, 1);
});

test('a leap-day cutoff still compares the same dates with non-leap years', () => {
    const data = A.createArchive([...days('2023-01-01', '2023-02-28', 1), ...days('2024-01-01', '2024-02-29', 2)]);
    const result = A.historyToDate(data, A.period('annual'), 'total');
    assert.equal(result.cutoff, '2024-02-29');
    assert.equal(result.end, '2024-02-28');
    assert.equal(result.expected, 59);
    assert.deepEqual(result.rows.map(p => p.value), [59, 118]);
});

test('year-to-date archive values and reference ranks match independent CET/EWP calculations', () => {
    for (const [file, aggregation] of [['MeanTempCET.csv', 'mean'], ['PrecipitationEWP.csv', 'total']]) {
        const observations = readFileSync(path.join(__dirname, '../public/data', file), 'utf8').trim().split(/\r?\n/).slice(1).map(line => {
            let [iso, value] = line.split(',');
            if (iso.includes('/')) iso = iso.split('/').reverse().join('-');
            return { iso, value: Number(value) };
        }).sort((a, b) => a.iso.localeCompare(b.iso));
        const latest = observations.at(-1).iso;
        const cutoff = latest.slice(5);
        const byYear = new Map();
        for (const observation of observations) {
            if (observation.iso.slice(5) === '02-29' || observation.iso.slice(5) > cutoff) continue;
            const year = Number(observation.iso.slice(0, 4));
            if (!byYear.has(year)) byYear.set(year, []);
            byYear.get(year).push(observation.value);
        }
        const result = A.historyToDate(A.createArchive(observations.map(p => row(p.iso, p.value))), A.period('annual'), aggregation);
        assert.equal(result.cutoff, latest);
        for (const entry of result.rows) {
            const values = byYear.get(entry.year);
            const expected = values.reduce((sum, n) => sum + n, 0) / (aggregation === 'mean' ? values.length : 1);
            assert.equal(entry.value, expected);
            assert.equal(entry.days, values.length);
        }
        const current = result.rows.find(p => p.year === result.referenceYear);
        assert.equal(current.rank, 1 + result.rows.filter(p => p.complete && p.value > current.value + 1e-10).length);
        assert.equal(current.complete, true);
    }
});
