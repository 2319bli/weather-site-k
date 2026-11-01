const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const publicDir = path.join(__dirname, '../public');

// Exercise the original loaders directly from the HTML, including the mixed
// date formats in the real archive. No replacement data layer is involved.
for (const [page, dataset] of [['index', 'MeanTempCET.csv'], ['threshold', 'MeanTempCET.csv'], ['ewp', 'PrecipitationEWP.csv']]) {
  test(`${page}: original loader retains every observed date and value`, async () => {
    const html = readFileSync(path.join(publicDir, page + '.html'), 'utf8');
    const helpers = html.slice(html.indexOf('function dayOfYear('), html.indexOf('function latestDateForYear('));
    const source = readFileSync(path.join(publicDir, 'data', dataset), 'utf8');
    const context = {
      fetch: async url => {
        assert.equal(url, 'data/' + dataset);
        return { ok: true, text: async () => source };
      }
    };
    vm.createContext(context);
    vm.runInContext(helpers, context);
    const actual = await context.loadCsvRows('data/' + dataset);
    const expected = source.trim().split(/\r?\n/).slice(1).map(line => {
      const [date, value] = line.split(',');
      return [date.includes('/') ? date.split('/').reverse().join('-') : date, Number(value)];
    });
    assert.equal(actual.length, expected.length);
    for (let index = 0; index < expected.length; index++) {
      assert.equal(actual[index].date.toISOString().slice(0, 10), expected[index][0]);
      assert.equal(actual[index].value, expected[index][1]);
    }
    assert.equal(context.parseDateFlexible('01/02/1900').toISOString().slice(0, 10), '1900-02-01');
    assert.equal(context.parseDateFlexible('2000-02-29').toISOString().slice(0, 10), '2000-02-29');
  });
}
