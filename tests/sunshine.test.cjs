const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const api = import('../public/sunshine-data.mjs');
const source = region => fs.readFileSync(path.join(__dirname, '../public/data/sunshine', region + '.txt'), 'utf8');

test('all Met Office monthly columns and published aggregates survive fixed-width parsing', async () => {
  const { parseSunshine, SUNSHINE } = await api;
  for (const { file } of Object.values(SUNSHINE)) {
    const text = source(file.slice(0,-4)), data = parseSunshine(text);
    assert.equal(data.records.length, 1401);
    assert.equal(data.records[0].month, '1910-01');
    assert.equal(data.records.at(-1).month, '2026-09');
    assert.ok(data.sourceUpdated.startsWith('01-Oct-2026'));
    const lines = text.trimEnd().split('\n');
    // Complete-year whitespace tokens are an independent check on every parsed cell.
    for (const line of lines.filter(line => /^\d{4}/.test(line) && !line.startsWith('2026'))) {
      const [year, ...cells] = line.trim().split(/\s+/);
      for (let i = 0; i < 12; i++) assert.equal(data.records.find(row => row.month === `${year}-${String(i+1).padStart(2,'0')}`).value, Number(cells[i]));
      for (const [i,key] of ['win','spr','sum','aut','ann'].entries()) assert.equal(data.published[year][key], cells[12+i] === '---' ? undefined : Number(cells[12+i]));
    }
    assert.equal(data.published[2026].aut, undefined);
    assert.equal(data.published[2026].ann, undefined);
    assert.equal(data.records.find(row => row.month === '2026-10'), undefined);
    const last = lines.at(-1).trim().split(/\s+/).map(Number);
    assert.equal(data.published[2026].win, last[10]);
    assert.equal(data.published[2026].spr, last[11]);
    assert.equal(data.published[2026].sum, last[12]);
  }
});

test('sunshine period totals preserve official rounding and exclude incomplete periods from ranks', async () => {
  const { parseSunshine, sunshineHistory, PERIODS } = await api;
  const data = parseSunshine(source('UK'));
  assert.equal(sunshineHistory(data,'annual','ann').rows[0].value, 1313.5);
  const annual = sunshineHistory(data,'annual','ann');
  assert.equal(annual.ranked,116);
  assert.equal(annual.rows.at(-1).count,9);
  assert.equal(annual.rows.at(-1).rank,null);
  const winter = sunshineHistory(data,'seasons','win');
  assert.equal(winter.rows[0].rank,null);
  assert.equal(winter.rows.at(-1).value,135.8);
  assert.equal(winter.rows.at(-1).complete,true);
  for (const kind of ['months','hex']) for (const period of PERIODS[kind]) {
    for (const row of sunshineHistory(data,kind,period.key).rows) {
      const values = data.records.filter(record => record.month.startsWith(`${row.year}-`) && period.months.includes(Number(record.month.slice(5))));
      assert.equal(row.value,Math.round(values.reduce((sum, record) => sum+record.value,0)*10)/10);
      assert.equal(row.complete,values.length === period.months.length);
    }
  }
});

test('matching-month comparisons, zero values, ties, missing months and December winter rollover', async () => {
  const { parseSunshine, sunshineHistory, appendSunshine } = await api;
  const data = parseSunshine(source('UK'));
  const history = sunshineHistory(data,'annual','ann',true);
  assert.deepEqual(history.months,[1,2,3,4,5,6,7,8,9]);
  assert.equal(history.ranked,117);
  for (const row of history.rows) {
    const total = data.records.filter(r => r.month.startsWith(`${row.year}-`) && Number(r.month.slice(5)) <=9).reduce((sum,r) => sum+r.value,0);
    assert.equal(row.value,Math.round(total*10)/10);
  }
  assert.equal(sunshineHistory(data,'months','10',true).rows.length,0);
  assert.deepEqual(sunshineHistory(data,'seasons','aut',true).months,[9]);
  data.records = appendSunshine(data.records,[{month:'2026-10',value:86.3},{month:'2026-11',value:0},{month:'2026-12',value:40}]);
  assert.equal(sunshineHistory(data,'annual','ann').rows.at(-1).complete,true);
  const winter = sunshineHistory(data,'seasons','win',true);
  assert.equal(winter.referenceYear,2027);
  assert.deepEqual(winter.months,[0]);
  assert.equal(winter.rows.at(-1).value,40);
  const sparse = { records: [{month:'2024-01',value:0},{month:'2025-01',value:0},{month:'2025-02',value:1},{month:'2026-02',value:0}], published:{} };
  const zeros = sunshineHistory(sparse,'months','1');
  assert.deepEqual(zeros.rows.map(row => row.rank),[1,1]);
  assert.equal(sunshineHistory(sparse,'hex','win').rows.at(-1).rank,null);
});

test('monthly sunshine commands validate syntax, consecutive months and numeric hours', async () => {
  const { parseSunshineCommand, appendSunshine, validateSunshineUpdates, sunshineDataset, nextMonth } = await api;
  const baseline = [{month:'2026-09',value:124.6}];
  for (const dataset of ['sunuk','suneng','suneaw','sunmid']) {
    const cmd = parseSunshineCommand(`conf ${dataset} "2026-10 86.3"`);
    assert.deepEqual(cmd,{action:'conf',dataset,updates:[{month:'2026-10',value:86.3}]});
    assert.equal(appendSunshine(baseline,cmd.updates).at(-1).value,86.3);
    assert.equal(parseSunshineCommand(`dat ${dataset}`).dataset,dataset);
  }
  assert.equal(parseSunshineCommand('conf cet "2026-10-01 9.5"'),null);
  assert.equal(parseSunshineCommand('CONF SUNUK "\n2026-10 86.3\n2026-11 0\n"').updates.length,2);
  assert.equal(nextMonth('2026-12'),'2027-01');
  for (const command of ['conf sunuk "2026-13 86.3"','conf sunuk "2026-10-01 86.3"','conf sunuk "01/10/2026 86.3"','conf sunuk "2026-10 -1"','conf sunuk "2026-10 NaN"','conf sunuk ""','dat sunuk extra']) assert.throws(() => parseSunshineCommand(command));
  for (const month of ['2026-09','2026-11']) assert.throws(() => appendSunshine(baseline,[{month,value:2}]),/Expected 2026-10/);
  assert.throws(() => appendSunshine(baseline,[{month:'2026-10',value:1},{month:'2026-10',value:2}]),/Expected 2026-11/);
  for (const value of [true,null,'86.3',Infinity,-1,745]) assert.throws(() => validateSunshineUpdates([{month:'2026-10',value}]));
  assert.throws(() => validateSunshineUpdates([{month:'2026-02',value:673}]));
  assert.doesNotThrow(() => validateSunshineUpdates([{month:'2028-02',value:696}]));
  for (const dataset of ['constructor','__proto__','cet']) assert.throws(() => sunshineDataset(dataset));
});
