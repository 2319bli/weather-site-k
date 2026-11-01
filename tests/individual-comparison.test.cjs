const { test } = require('node:test');
const assert = require('node:assert/strict');
const I = require('../public/individual-comparison.js');
const A = require('../public/temperature-data.js');

test('comparison years prevent duplicates, preserve a final year and enforce the ten-year limit', () => {
  const selected = I.createSelection();
  const available = Array.from({length:15},(_,i)=>2026-i);
  assert.deepEqual(selected.update(available,2026),[2026]);
  assert.equal(selected.remove(2026),false);
  assert.equal(selected.add(2026),false);
  assert.equal(selected.add(1772),false);
  for (const year of available.slice(1,10)) assert.equal(selected.add(year),true);
  assert.equal(selected.full(),true); assert.equal(selected.add(2016),false);
  assert.equal(new Set(selected.years().map(selected.colour)).size,10);
  const colours = new Map(selected.years().map(year=>[year,selected.colour(year)]));
  assert.equal(selected.remove(2022),true); assert.equal(selected.full(),false);
  assert.equal(selected.add(2016),true);
  assert.equal(new Set(selected.years().map(selected.colour)).size,10);
  selected.years().filter(year=>year!==2016).forEach(year=>assert.equal(selected.colour(year),colours.get(year)));
  assert.equal(selected.choices().includes(2016),false);
});

test('year selections and colours survive period, region and data changes', () => {
  const selected = I.createSelection();
  selected.update([2026,2025,2020],2026); selected.add(2020);
  const colour = selected.colour(2020);
  assert.deepEqual(selected.update([2027,2026,2025,2020],2027),[2026,2020]);
  assert.equal(selected.colour(2020),colour);
  selected.remove(2026); selected.add(2025);
  assert.equal(selected.colour(2020),colour);
  assert.notEqual(selected.colour(2025),colour);
  assert.deepEqual(selected.update([2025,2020],2025),[2020,2025]);
  assert.deepEqual(selected.update([1911,1910],1910),[1910]);
  const copy = selected.years(); copy.push(1909);
  assert.deepEqual(selected.years(),[1910]);
});

test('rainfall and sunshine traces group each year separately without filling missing periods', () => {
  for (const kind of ['rainfall','sunshine']) {
    const rows = [
      {label:'Jan',start:'2026-01-01',end:'2026-01-31',value:0,days:31,count:1,expected:31,complete:true},
      {label:'Feb',start:'2026-02-01',end:'2026-02-28',value:22.5,days:10,count:1,expected:28,complete:false},
      {label:'Mar',start:'2026-03-01',end:'2026-03-31',value:null,days:0,count:0,expected:31,complete:false}
    ];
    const traces = I.traces([{year:2026,colour:'#123456',rows},{year:2025,colour:'#654321',rows:rows.map(row=>({...row,value:100}))}],kind,['Jan','Feb','Mar'],date=>date);
    assert.deepEqual(traces.map(trace=>trace.offsetgroup),['2026','2025']);
    assert.deepEqual(traces.map(trace=>trace.name),['2026','2025']);
    assert.deepEqual(traces[0].x,traces[1].x);
    assert.deepEqual(traces[0].y,[0,22.5,null]);
    assert.deepEqual(traces[1].y,[100,100,100]);
    assert.deepEqual(traces[0].marker.pattern.shape,['','/','']);
    assert.equal(traces[0].textposition,'none'); assert.equal(traces[0].type,'bar');
    assert.equal(traces[0].marker.color,'#123456');
    assert.equal(traces[1].marker.color,'#654321');
    assert.match(traces[0].text[1],/2026.*Incomplete period/);
  }
});

test('each temperature line keeps its own means, gaps, colour and incomplete-period markers', () => {
  const observations = [
    {date:new Date('2025-01-01T00:00:00Z'),value:2},
    {date:new Date('2025-01-02T00:00:00Z'),value:4},
    {date:new Date('2026-01-01T00:00:00Z'),value:8},
    {date:new Date('2026-03-01T00:00:00Z'),value:10}
  ];
  const archive = A.createArchive(observations);
  const series = [2026,2025].map((year,i)=>({year,colour:i?'#654321':'#123456',rows:A.breakdown(archive,'months',year)}));
  const traces = I.traces(series,'temperature',series[0].rows.map(row=>row.label),date=>date);
  assert.equal(traces.length,2);
  assert.deepEqual(traces[0].y.slice(0,3),[8,null,10]);
  assert.deepEqual(traces[1].y.slice(0,3),[3,null,null]);
  assert.equal(traces[0].type,'scatter'); assert.equal(traces[0].mode,'lines+markers');
  assert.equal(traces[0].connectgaps,false);
  assert.equal(traces[0].marker.symbol[0],'diamond-open');
  assert.equal(traces[0].line.color,'#123456'); assert.equal(traces[1].line.color,'#654321');
  assert.match(traces[0].hovertemplate,/Mean CET/);
});
