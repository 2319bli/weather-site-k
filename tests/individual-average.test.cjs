const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const I = require('../public/individual-comparison.js');
const A = require('../public/temperature-data.js');
const close = (a,b) => assert.ok(Math.abs(a-b) < 1e-8, `${a} != ${b}`);
const readData = name => fs.readFileSync(path.join(__dirname,'../public/data',name),'utf8');
const windows = [
  ['months',[0,1,2,3,4,5,6,7,8,9,10,11],1],
  ['seasons',[-1,2,5,8],3], ['hex-seasons',[0,2,4,6,8,10],2]
];

test('reference requires all 30 complete years, preserves zero and renders distinct bars or a dashed line', () => {
  const called = [];
  const average = I.averageSeries(year => {
    called.push(year);
    return [
      {label:'A',value:year-1990,complete:true},
      {label:'B',value:0,complete:true},
      {label:'C',value:20,complete:year!==2000},
      {label:'D',value:year===2000 ? null : 5,complete:true}
    ];
  }, '#555555');
  assert.deepEqual(called,Array.from({length:30},(_,i)=>1991+i));
  assert.deepEqual(average.rows.map(row=>row.value),[15.5,0,null,null]);
  assert.deepEqual(average.rows.map(row=>row.years),[30,30,29,29]);
  for (const kind of ['temperature','rainfall','sunshine']) {
    const [trace] = I.traces([average],kind,['A','B','C','D'],()=>{throw new Error('Reference must not format an individual year date');});
    assert.equal(trace.name,'1991–2020 average');
    assert.match(trace.text[0],/30\/30 complete years/);
    if (kind==='temperature') {
      assert.equal(trace.line.dash,'dash'); assert.equal(trace.connectgaps,false);
    } else {
      assert.equal(trace.offsetgroup,'1991–2020 average');
      assert.deepEqual(trace.marker.pattern.shape,['','','','']);
    }
  }
  assert.match(I.averageNote(average),/left blank/);
});

test('CET and rainfall reference values match independently averaged calendar periods for 1991–2020', async () => {
  const {parseObservations} = await import('../public/dashboard-stats.mjs');
  for (const [file,aggregation] of [['MeanTempCET.csv','mean'],['PrecipitationEWP.csv','total']]) {
    const observed = parseObservations(readData(file)).filter(row => row.iso >= '1990-12-01' && row.iso <= '2020-12-31');
    const archive = A.createArchive(observed.map(row=>({date:new Date(`${row.iso}T00:00:00Z`),value:row.value})));
    for (const [kind,starts,length] of windows) {
      const average = I.averageSeries(year=>A.breakdown(archive,kind,year,aggregation),'#555555');
      starts.forEach((month,i)=>{
        let sum = 0;
        for (let year=1991;year<=2020;year++) {
          const first = new Date(Date.UTC(year,month,1)), last = new Date(Date.UTC(year,month+length,0));
          const start = first.toISOString().slice(0,10), end = last.toISOString().slice(0,10);
          const values = observed.filter(row=>row.iso>=start && row.iso<=end);
          assert.equal(values.length,(last-first)/86400000+1);
          sum += values.reduce((total,row)=>total+row.value,0)/(aggregation==='mean'?values.length:1);
        }
        close(average.rows[i].value,sum/30);
        assert.equal(average.rows[i].years,30);
      });
    }
  }
});

test('sunshine references follow regional monthly sums and published seasonal totals', async () => {
  const {SUNSHINE,parseSunshine,sunshineBreakdown} = await import('../public/sunshine-data.mjs');
  const january = [];
  for (const {file} of Object.values(SUNSHINE)) {
    const data = parseSunshine(readData(`sunshine/${file}`));
    const values = new Map(data.records.map(row=>[row.month,row.value]));
    for (const [view,starts,length] of windows) {
      const kind = view==='hex-seasons'?'hex':view;
      const average = I.averageSeries(year=>sunshineBreakdown(data,kind,year),'#555555');
      starts.forEach((month,i)=>{
        let sum = 0;
        for (let year=1991;year<=2020;year++) {
          let total = 0;
          for (let m=month;m<month+length;m++) {
            const key = new Date(Date.UTC(year,m,1)).toISOString().slice(0,7);
            assert.ok(values.has(key)); total += values.get(key);
          }
          const published = kind==='seasons' ? data.published[year][['win','spr','sum','aut'][i]] : undefined;
          sum += published ?? Math.round(total*10)/10;
        }
        close(average.rows[i].value,sum/30);
        assert.equal(average.rows[i].years,30);
      });
      if (kind==='months') january.push(average.rows[0].value);
    }
  }
  assert.equal(new Set(january).size,4,'regional references must not reuse UK values');
});
