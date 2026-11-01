const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const A = require('../public/temperature-data.js');
const close = (a,b) => assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const row = (iso,value) => ({date:new Date(`${iso}T00:00:00Z`),value});
const iso = date => date.toISOString().slice(0,10);

test('individual CET means and rainfall totals match independent calendar windows', async () => {
  const {parseObservations} = await import('../public/dashboard-stats.mjs');
  for (const [file,aggregation] of [['MeanTempCET.csv','mean'],['PrecipitationEWP.csv','total']]) {
    const observed = parseObservations(fs.readFileSync(path.join(__dirname,'../public/data',file),'utf8'));
    const archive = A.createArchive(observed.map(record => row(record.iso,record.value)));
    for (const year of [2020,2025,2026]) for (const [view,starts,length] of [
      ['months',[0,1,2,3,4,5,6,7,8,9,10,11],1],
      ['seasons',[-1,2,5,8],3], ['hex-seasons',[0,2,4,6,8,10],2]
    ]) {
      const breakdown = A.breakdown(archive,view,year,aggregation);
      assert.equal(breakdown.length,starts.length);
      starts.forEach((month,index) => {
        const start = new Date(Date.UTC(year,month,1));
        const end = new Date(Date.UTC(year,month+length,0));
        const values = observed.filter(record => record.iso>=iso(start) && record.iso<=iso(end));
        const actual = breakdown[index];
        assert.equal(actual.days,values.length);
        assert.equal(actual.expected,(end-start)/86400000+1);
        assert.equal(actual.complete,actual.days===actual.expected);
        assert.equal(actual.start,iso(start)); assert.equal(actual.end,iso(end));
        if (values.length) close(actual.value,values.reduce((sum,r) => sum+r.value,0)/(aggregation==='mean'?values.length:1));
        else assert.equal(actual.value,null);
      });
    }
  }
});

test('individual periods retain leap day, weighted means, zero values and missing-data gaps', () => {
  const observed = [...Array.from({length:31},(_,i) => row(`2023-01-${String(i+1).padStart(2,'0')}`,10)),
    ...Array.from({length:28},(_,i) => row(`2023-02-${String(i+1).padStart(2,'0')}`,20))];
  const weighted = A.breakdown(A.createArchive(observed),'hex-seasons',2023)[0];
  close(weighted.value,(31*10+28*20)/59);
  assert.notEqual(weighted.value,15); assert.equal(weighted.complete,true);
  const archive = A.createArchive([row('2023-12-01',4),row('2024-01-01',0),row('2024-02-29',10),row('2024-04-01',3)]);
  const months = A.breakdown(archive,'months',2024,'total');
  assert.equal(months[0].value,0); assert.equal(months[0].days,1); assert.equal(months[0].complete,false);
  assert.equal(months[1].expected,29); assert.equal(months[1].value,10);
  assert.equal(months[2].value,null); assert.equal(months[2].days,0);
  assert.equal(months[3].value,3,'individual values do not accumulate previous periods');
  const winter = A.breakdown(archive,'seasons',2024,'total')[0];
  assert.equal(winter.value,14); assert.equal(winter.expected,91);
  assert.equal(winter.start,'2023-12-01'); assert.equal(winter.end,'2024-02-29');
  assert.throws(() => A.breakdown(archive,'annual',2024),/Choose/);
});

test('sunshine breakdowns retain regional published totals, monthly sums and partial coverage', async () => {
  const {SUNSHINE,parseSunshine,sunshineBreakdown,sunshineHistory,PERIODS} = await import('../public/sunshine-data.mjs');
  for (const {file} of Object.values(SUNSHINE)) {
    const data = parseSunshine(fs.readFileSync(path.join(__dirname,'../public/data/sunshine',file),'utf8'));
    for (const year of [1910,2025,2026]) for (const kind of ['months','seasons','hex']) {
      const rows = sunshineBreakdown(data,kind,year);
      assert.equal(rows.length,kind==='months'?12:kind==='seasons'?4:6);
      for (const [i,period] of PERIODS[kind].entries()) {
        const historical = sunshineHistory(data,kind,period.key).rows.find(row => row.year===year);
        assert.equal(rows[i].value,historical?.value ?? null);
        assert.equal(rows[i].count,historical?.count ?? 0);
        assert.equal(rows[i].complete,historical?.complete ?? false);
      }
      if (year===2025 && kind==='hex') {
        const annualMonthlySum = data.records.filter(row => row.month.startsWith('2025-')).reduce((sum,row)=>sum+row.value,0);
        close(rows.reduce((sum,row)=>sum+row.value,0),annualMonthlySum);
      }
    }
  }
  const uk = parseSunshine(fs.readFileSync(path.join(__dirname,'../public/data/sunshine/UK.txt'),'utf8'));
  assert.equal(sunshineBreakdown(uk,'seasons',2026)[0].value,135.8);
  assert.equal(sunshineBreakdown(uk,'seasons',2026)[3].value,124.6);
  assert.equal(sunshineBreakdown(uk,'seasons',2026)[3].count,1);
  assert.equal(sunshineBreakdown(uk,'seasons',2026)[3].complete,false);
  assert.equal(sunshineBreakdown(uk,'hex',2026)[5].value,null);
  assert.equal(sunshineBreakdown({records:[{month:'2026-01',value:0}],published:{}},'months',2026)[0].value,0);
  assert.throws(()=>sunshineBreakdown(uk,'annual',2026),/Choose/);
});
