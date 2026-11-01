const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const A = require('../public/temperature-data.js');
const row = (iso, value) => ({ date: new Date(`${iso}T00:00:00Z`), value });
const archive = rows => A.createArchive(rows.map(([iso, value]) => row(iso, value)));
const completePeriod = (period, year, value) => A.slots(period, year).map(day => row(day.iso, value));

test('daily dates align after leap day; missing observations stay gaps', () => {
    const data = archive([['2023-02-28', 3], ['2023-03-01', 4], ['2024-02-28', 5], ['2024-02-29', 6], ['2024-03-01', 7], ['2024-03-03', 9]]);
    const daily = A.daily(data, A.period('annual'), [2023, 2024]);
    assert.deepEqual(daily.series[0].observed.slice(58, 62).map(p => p?.value ?? null), [3, null, 4, null]);
    assert.deepEqual(daily.series[1].observed.slice(58, 63).map(p => p?.value ?? null), [5, 6, 7, null, 9]);
    assert.equal(daily.records[59].high, 6);
    assert.equal(daily.records[60].high, 7);
});

test('daily records include ties and only records still held; forecasts never set records', () => {
    const data = archive([['2000-07-01', 20], ['2001-07-01', 20], ['2002-07-01', 18], ['2000-07-02', 7], ['2001-07-02', 8], ['2002-07-02', 6]]);
    const period = A.period('months', 7);
    const held = A.heldRecords(data, period, 2000);
    assert.equal(held.length, 1);
    assert.equal(held[0].kind, 'Warmest');
    assert.equal(held[0].tied, true);
    assert.deepEqual(held[0].years, [2000, 2001]);
    const daily = A.daily(data, period, [2002], [row('2002-07-01', 99), row('2002-07-03', 50)]);
    assert.equal(daily.series[0].forecast[0], null, 'overlapping forecast is excluded');
    assert.equal(daily.series[0].forecast[2].value, 50);
    assert.equal(daily.records[2], null, 'forecast cannot create an archive record');
    assert.equal(A.history(data, period).at(-1).mean, 12);
});

test('winter daily series and held records include the preceding December', () => {
    const data = archive([['2023-12-31', 12], ['2024-01-01', 2], ['2024-02-29', 3], ['2024-12-31', 13], ['2025-01-01', 1], ['2025-03-01', 8]]);
    const period = A.period('seasons', 'winter');
    const daily = A.daily(data, period, [2024, 2025]);
    assert.equal(daily.series[0].observed[30].iso, '2023-12-31');
    assert.equal(daily.series[0].observed[31].iso, '2024-01-01');
    assert.equal(daily.series[0].observed[90].iso, '2024-02-29');
    assert.equal(daily.series[1].observed[90], null);
    const held = A.heldRecords(data, period, 2025);
    assert.ok(held.some(p => p.iso === '2024-12-31' && p.kind === 'Warmest'));
    assert.ok(held.every(p => p.month !== 3));
    assert.equal(A.history(data, period).find(p => p.year === 2024).expected, 91);
    assert.equal(A.history(data, period).find(p => p.year === 2025).expected, 90);
});

test('historical means cover all four period types, rank ties and leave partial periods unranked', () => {
    for (const period of [A.period('annual'), A.period('months', 2), A.period('seasons', 'winter'), A.period('hex-seasons', 'pra')]) {
        const data = A.createArchive([
            ...completePeriod(period, 2022, 7), ...completePeriod(period, 2023, 7),
            ...completePeriod(period, 2024, 4), ...completePeriod(period, 2025, 20).slice(0, 10)
        ]);
        const history = A.history(data, period);
        assert.deepEqual(history.map(p => p.mean), [7, 7, 4, 20]);
        assert.deepEqual(history.map(p => p.rank), [1, 1, 3, null]);
        assert.deepEqual(history.map(p => p.complete), [true, true, true, false]);
        assert.equal(history.at(-1).days, 10);
    }
});

test('historical missing days and duplicated dates cannot masquerade as full periods', () => {
    const period = A.period('months', 2);
    const rows = completePeriod(period, 2024, 5);
    rows.splice(10, 1);
    rows.push(rows[0]);
    const [result] = A.history(A.createArchive(rows), period);
    assert.equal(result.days, 28);
    assert.equal(result.expected, 29);
    assert.equal(result.rank, null);
});

test('real archive means and daily record holders match independent calendar grouping', () => {
    const rows = readFileSync(new URL('../public/data/MeanTempCET.csv', `file://${__filename}`), 'utf8').trim().split(/\r?\n/).slice(1).map(line => {
        let [date, value] = line.split(',');
        if (date.includes('/')) date = date.split('/').reverse().join('-');
        return row(date, Number(value));
    });
    const data = A.createArchive(rows);
    const jan2020 = rows.filter(p => p.date.getUTCFullYear() === 2020 && p.date.getUTCMonth() === 0);
    const history = A.history(data, A.period('months', 1));
    assert.equal(history.find(p => p.year === 2020).mean, jan2020.reduce((sum, p) => sum + p.value, 0) / 31);
    assert.equal(history[0].year, 1772);
    const july19 = rows.filter(p => p.date.getUTCMonth() === 6 && p.date.getUTCDate() === 19);
    const high = Math.max(...july19.map(p => p.value));
    assert.equal(data.records.get('07-19').high, high);
    assert.deepEqual(data.records.get('07-19').highYears, july19.filter(p => p.value === high).map(p => p.date.getUTCFullYear()));
    assert.equal(A.history(data, A.period('annual')).at(-1).complete, false);
});
