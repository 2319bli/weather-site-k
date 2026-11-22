const {test} = require('node:test');
const assert = require('node:assert/strict');
const {outlook, cumulative, defaultYear} = require('../public/cet-outlook.js');

function row(iso, value) {
    const date = new Date(iso + 'T00:00:00Z');
    const year = date.getUTCFullYear();
    return { date, year, month: date.getUTCMonth() + 1, day: date.getUTCDate(),
        doy: (date - Date.UTC(year, 0, 0)) / 86400000, value, label: iso };
}

test('forecast years reset the annual mean and roll over at midnight UTC', () => {
    const actual = row('2026-12-30', 12);
    const future = outlook([actual], [row('2026-12-30', 99), row('2026-12-31', 8),
        row('2027-01-01', 1), row('2027-01-01', 2), row('2027-01-02', 4)]);
    const years = new Set(future.map(r => r.year));
    assert.equal(defaultYear(years, new Date('2026-12-31T23:59:59Z')), 2026);
    assert.equal(defaultYear(years, new Date('2027-01-01T00:00:00Z')), 2027);
    for (const [year, xs, ys] of [[2026, [364,365], [12,10]], [2027, [1,2], [2,3]]]) {
        const series = cumulative([actual, ...future].filter(r => r.year === year), year, 'red', r => r.doy, 'YTD mean');
        const trace = series.traces.find(t => t.name === year + ' forecast (YTD mean)');
        assert.equal(trace.name, year + ' forecast (YTD mean)');
        assert.deepEqual(trace.x, xs);
        assert.deepEqual(trace.y, ys);
    }
    const winter = cumulative(future.filter(r => r.month === 1 || r.year === 2026), 2027, 'red', r => r.month === 12 ? r.day : 31+r.day, 'Winter mean');
    assert.deepEqual(winter.traces.map(t => t.x), [[31], [32,33]]);
});

test('February–December placeholders use calendar-day normals and yield to forecasts and observations', () => {
    const normals = [row('2017-02-01', 2), row('2026-02-01', 6), row('2016-02-01', 99),
        row('2020-02-02', 5), row('2020-12-31', 7), row('2020-01-01', 8)];
    const forecasts = [row('2027-01-31', 6), row('2027-02-02', 3)];
    const future = outlook(normals, forecasts);
    assert.deepEqual(future.map(r => [r.month, r.day, r.source, r.value]), [
        [1,31,'forecast',6], [2,1,'projection',4], [2,2,'forecast',3], [12,31,'projection',7]
    ]);
    const traces = cumulative(future, 2027, 'red', r => r.doy, 'YTD mean').traces;
    assert.ok(traces.every(trace => trace.line.dash === 'dot'));
    assert.deepEqual(traces[1].y, [6,5]);
    assert.deepEqual(outlook([...normals,row('2027-02-02', 10)], forecasts).map(r => r.value), [7]);
});
