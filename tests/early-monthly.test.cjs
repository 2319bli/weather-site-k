const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const A = require('../public/temperature-data.js');

for (const [dataset, start, dailyStart, annual, january, aggregation] of [
    ['cet', 1659, 1772, 8.87, 3, 'mean'],
    ['ewp', 1766, 1931, 805.5, 4.4, 'total']
]) test(dataset + ' monthly archive spans the daily boundary without creating daily records', () => {
    const context = { window: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/data', dataset + '-early.js'), 'utf8'), context);
    const monthly = context.window.earlyMonthlyObservations;
    assert.deepEqual(Object.keys(monthly).map(Number), Array.from({length: dailyStart - start}, (_,i) => start + i));
    for (const values of Object.values(monthly)) {
        assert.equal(values.length, 13);
        assert.ok(values.every(Number.isFinite));
    }
    const daily = A.slots(A.period('hex-seasons', 'win'), dailyStart).map(slot => ({
        date: new Date(slot.iso + 'T00:00:00Z'), value: 2
    }));
    const archive = A.createArchive(daily, monthly);
    const history = A.history(archive, A.period('annual'), aggregation);
    assert.equal(history[0].value, annual);
    assert.equal(A.breakdown(archive, 'months', start, aggregation)[0].value, january);
    assert.equal(A.breakdown(archive, 'seasons', start, aggregation)[0].complete, false);
    const winter = A.history(archive, A.period('seasons', 'winter'), aggregation).at(-1);
    assert.equal(winter.year, dailyStart);
    assert.equal(winter.complete, true);
    const december = monthly[dailyStart - 1][11];
    const expected = aggregation === 'total' ? december + daily.length * 2 :
        (december * 31 + daily.length * 2) / (31 + daily.length);
    assert.equal(winter.value, expected);
    assert.deepEqual(A.years(archive, A.period('annual')), [dailyStart]);
    assert.deepEqual(A.historyToDate(archive, A.period('annual'), aggregation).rows.map(row => row.year), [dailyStart]);
});
