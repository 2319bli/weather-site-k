const { test } = require('node:test');
const assert = require('node:assert/strict');

test('Seasonal switches on the 1st, 11th and 21st in UK time, including leap years', async () => {
  const { seasonalDate } = await import('../public/seasonal-site.mjs');
  const { plates, spotColours } = await import('../public/seasonal-art.mjs');
  assert.equal(new Set(plates).size, 36);
  assert.equal(spotColours.length, 36);
  for (const [date, period] of [
    ['2026-06-10T22:59:59Z', 15], ['2026-06-10T23:00:00Z', 16],
    ['2026-06-20T23:00:00Z', 17], ['2026-06-30T23:00:00Z', 18],
    ['2028-02-29T23:59:59Z', 5], ['2028-03-01T00:00:00Z', 6],
    ['2026-12-31T23:59:59Z', 35], ['2027-01-01T00:00:00Z', 0]
  ]) assert.equal(seasonalDate(new Date(date)), period, date);
});
