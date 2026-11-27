export const SUNSHINE = Object.freeze({
  sunuk: { label: 'UK wide', file: 'UK.txt' },
  suneng: { label: 'England', file: 'England.txt' },
  suneaw: { label: 'England and Wales', file: 'England_and_Wales.txt' },
  sunmid: { label: 'Midlands', file: 'Midlands.txt' }
});
export const DAY_DATASETS = Object.freeze({
  midair: { label: 'Midlands', file: 'Midlands.txt', series: 'AirFrost' },
  ukair: { label: 'UK', file: 'UK.txt', series: 'AirFrost' },
  ewrd1: { label: 'England and Wales', file: 'England_and_Wales.txt', series: 'Raindays1mm' },
  ukrd1: { label: 'UK', file: 'UK.txt', series: 'Raindays1mm' }
});
export const MONTHLY_DATASETS = Object.freeze({ ...SUNSHINE, ...DAY_DATASETS });
export function monthlyDataset(key) {
  if (!Object.hasOwn(MONTHLY_DATASETS, key)) throw new Error('Unknown monthly dataset.');
  const info = MONTHLY_DATASETS[key];
  const series = info.series || 'Sunshine';
  const metric = { AirFrost: 'air frost days', Raindays1mm: 'rain days ≥1 mm', Sunshine: 'sunshine' }[series];
  return { ...info, metric, unit: info.series ? 'days' : 'hours',
    archive: (info.series || 'sunshine') + '/' + info.file,
    stateKey: (info.series ? 'monthly-' : 'sunshine-') + key,
    sourceUrl: `https://www.metoffice.gov.uk/pub/data/weather/uk/climate/datasets/${series}/date/${info.file}` };
}
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const PERIODS = {
  annual: [{ key: 'ann', label: 'Annual', months: [1,2,3,4,5,6,7,8,9,10,11,12], published: 'ann' }],
  months: MONTHS.map((label, i) => ({ key: String(i + 1), label, months: [i + 1] })),
  seasons: [
    { key: 'win', label: 'Winter (Dec–Feb)', months: [0,1,2], published: 'win' },
    { key: 'spr', label: 'Spring (Mar–May)', months: [3,4,5], published: 'spr' },
    { key: 'sum', label: 'Summer (Jun–Aug)', months: [6,7,8], published: 'sum' },
    { key: 'aut', label: 'Autumn (Sep–Nov)', months: [9,10,11], published: 'aut' }
  ],
  hex: [
    { key: 'win', label: 'Winter (Jan–Feb)', months: [1,2] },
    { key: 'spr', label: 'Spring (Mar–Apr)', months: [3,4] },
    { key: 'pra', label: 'Prasiner (May–Jun)', months: [5,6] },
    { key: 'xan', label: 'Xanther (Jul–Aug)', months: [7,8] },
    { key: 'aut', label: 'Autumn (Sep–Oct)', months: [9,10] },
    { key: 'pha', label: 'Phaier (Nov–Dec)', months: [11,12] }
  ]
};
export function sunshineDataset(key) {
  if (!Object.hasOwn(SUNSHINE, key)) throw new Error('Dataset must be sunuk, suneng, suneaw or sunmid.');
  return SUNSHINE[key];
}
export function sourceUrl(key) {
  return `https://www.metoffice.gov.uk/pub/data/weather/uk/climate/datasets/Sunshine/date/${sunshineDataset(key).file}`;
}
export function validMonth(month) { return typeof month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && Number(month.slice(0,4)) >= 1910; }
export function nextMonth(month) {
  if (!validMonth(month)) throw new Error('Use a valid month in YYYY-MM format (1910 onwards).');
  const [y,m] = month.split('-').map(Number);
  return `${y + (m === 12 ? 1 : 0)}-${String(m === 12 ? 1 : m + 1).padStart(2,'0')}`;
}
function monthKey(year, month) { return month === 0 ? `${year - 1}-12` : `${year}-${String(month).padStart(2,'0')}`; }
export function validateMonthlyUpdates(updates, unit = 'hours') {
  if (!Array.isArray(updates) || !updates.length || updates.length > 120) throw new Error('Supply 1–120 monthly totals.');
  return updates.map(row => {
    if (!row || !validMonth(row.month)) throw new Error('Use a valid month in YYYY-MM format (1910 onwards).');
    const [year, month] = row.month.split('-').map(Number);
    const maximum = new Date(Date.UTC(year, month, 0)).getUTCDate() * (unit === 'hours' ? 24 : 1);
    if (typeof row.value !== 'number' || !Number.isFinite(row.value) || row.value < 0 || row.value > maximum) throw new Error(`Value for ${row.month} must be between 0 and ${maximum} ${unit}.`);
    return { month: row.month, value: row.value };
  });
}
export function appendMonthly(records, updates, unit = 'hours') {
  const checked = validateMonthlyUpdates(updates, unit);
  let expected = nextMonth(records.at(-1).month);
  for (const row of checked) {
    if (row.month !== expected) throw new Error(`Expected ${expected}; confirmed months must follow the latest month consecutively.`);
    expected = nextMonth(row.month);
  }
  return [...records, ...checked];
}
export function parseMonthlyArchive(text) {
  const lines = text.replace(/\r/g, '').split('\n');
  const header = lines.findIndex(line => /^year\s+jan\s+feb\b/.test(line));
  if (header < 0) throw new Error('Monthly archive header is missing.');
  const columns = [...lines[header].matchAll(/\S+/g)].map(match => ({ key: match[0], end: match.index + match[0].length }));
  if (columns.map(c => c.key).join(' ') !== 'year jan feb mar apr may jun jul aug sep oct nov dec win spr sum aut ann') throw new Error('Unexpected monthly archive columns.');
  const records = [], published = {};
  let previousYear = null;
  for (const line of lines.slice(header + 1).filter(line => line.trim())) {
    const year = Number(line.slice(0,4));
    if (!/^\d{4}/.test(line) || year < 1000 || (previousYear !== null && year !== previousYear + 1)) throw new Error('Invalid monthly archive year sequence.');
    previousYear = year;
    published[year] = {};
    for (let i = 1; i < columns.length; i++) {
      // Blank future months retain their fixed-width columns before seasonal totals.
      const cell = line.slice(columns[i-1].end, columns[i].end).trim();
      if (!cell || cell === '---') continue;
      if (!/^\d+(?:\.\d+)?$/.test(cell)) throw new Error(`Invalid monthly value for ${year} ${columns[i].key}.`);
      const value = Number(cell);
      if (i <= 12) records.push({ month: monthKey(year,i), value });
      else published[year][columns[i].key] = value;
    }
  }
  if (!records.length) throw new Error('Monthly archive has no observations.');
  return { records, published, sourceUpdated: lines.find(line => line.startsWith('Last updated '))?.slice(13) || '' };
}
export function parseMonthlyCommand(command) {
  const match = /^(dat|conf)\s+(\w+)\b\s*([\s\S]*)$/i.exec(command.trim());
  if (!match) return null;
  const action = match[1].toLowerCase();
  let dataset = match[2].toLowerCase(), body = match[3].trim();
  if (dataset === 'air' || dataset === 'rd1') {
    const region = /^(midair|ukair|ewrd1|ukrd1)\b\s*/i.exec(body);
    if (region && !region[1].toLowerCase().endsWith(dataset)) throw new Error('Region code does not match this dataset.');
    dataset = region ? region[1].toLowerCase() : dataset === 'air' ? 'midair' : 'ewrd1';
    if (region) body = body.slice(region[0].length);
  }
  if (!Object.hasOwn(MONTHLY_DATASETS, dataset)) return null;
  const { unit } = monthlyDataset(dataset);
  if (action === 'dat') {
    if (body) throw new Error(`Use dat ${dataset} without extra arguments.`);
    return { action, dataset };
  }
  if (body.startsWith('"') && body.endsWith('"')) body = body.slice(1,-1).trim();
  const updates = body.split(/\r?\n/).filter(line => line.trim()).map(line => {
    const row = /^(\d{4}-\d{2})\s+(\d+(?:\.\d+)?)$/.exec(line.trim());
    if (!row) throw new Error(`Each line must be YYYY-MM followed by a value in ${unit}.`);
    return { month: row[1], value: Number(row[2]) };
  });
  return { action, dataset, updates: validateMonthlyUpdates(updates, unit) };
}
export function monthlyHistory(data, kind, key, toDate = false) {
  const period = PERIODS[kind]?.find(period => period.key === key);
  if (!period) throw new Error('Unknown sunshine period.');
  const values = new Map(data.records.map(row => [row.month, row.value]));
  const latest = data.records.at(-1).month;
  let referenceYear = Number(latest.slice(0,4));
  if (kind === 'seasons' && key === 'win' && latest.endsWith('-12')) referenceYear++;
  const months = toDate ? period.months.filter(m => monthKey(referenceYear,m) <= latest) : period.months;
  const rows = [];
  if (months.length) {
    for (let year = Number(data.records[0].month.slice(0,4)); year <= referenceYear; year++) {
      const observed = months.map(m => values.get(monthKey(year,m))).filter(v => v !== undefined);
      if (!observed.length) continue;
      const complete = observed.length === months.length;
      const published = complete && months.length === period.months.length && period.published ? data.published?.[year]?.[period.published] : undefined;
      const value = published ?? Math.round(observed.reduce((a,b) => a+b,0) * 10) / 10;
      rows.push({ year, value, complete, count: observed.length, expected: months.length, published: published !== undefined });
    }
  }
  const complete = rows.filter(row => row.complete);
  for (const row of rows) row.rank = row.complete ? 1 + complete.filter(other => other.value > row.value).length : null;
  return { rows, period, months, latest, referenceYear, ranked: complete.length };
}

export function sunshineBreakdown(data, kind, year) {
  if (!PERIODS[kind]) throw new Error('Unknown sunshine period.');
  const values = new Map(data.records.map(row => [row.month, row.value]));
  return PERIODS[kind].map(period => {
    const months = period.months.map(month => monthKey(year, month));
    const observed = months.map(month => values.get(month)).filter(value => value !== undefined);
    const complete = observed.length === months.length;
    const published = complete && period.published ? data.published?.[year]?.[period.published] : undefined;
    return { label: period.label, year, count: observed.length, expected: months.length, complete,
      start: months[0], end: months.at(-1),
      value: observed.length ? published ?? Math.round(observed.reduce((a,b) => a+b, 0) * 10) / 10 : null };
  });
}

// The regional records passed in contain confirmed monthly totals only.
export function sunshineOutlook2027(data, kind) {
  const values = new Map(data.records.map(row => [row.month, row.value]));
  const monthly = Array.from({length: 12}, (_, i) => {
    const samples = [];
    for (let year = 2017; year <= 2026; year++) {
      const value = values.get(monthKey(year, i + 1));
      if (Number.isFinite(value)) samples.push(value);
    }
    return samples.length ? samples.reduce((a,b) => a+b, 0) / samples.length : null;
  });
  return sunshineBreakdown(data, kind, 2027).map((row, i) => {
    if (row.complete) return row;
    const months = PERIODS[kind][i].months;
    let value = 0, projected = 0;
    for (const month of months) {
      const actual = values.get(monthKey(2027, month));
      if (actual !== undefined) value += actual;
      else {
        const estimate = monthly[(month + 11) % 12];
        if (estimate === null) continue;
        projected++;
        value += estimate;
      }
    }
    const count = row.count + projected;
    return { ...row, value: count ? Math.round(value * 10) / 10 : null, projected,
      coverage: row.count + ' confirmed + ' + projected + ' projected months', count, complete: count === months.length };
  });
}

// Keep the sunshine page and the original monthly API compatible.
export { parseMonthlyArchive as parseSunshine, monthlyHistory as sunshineHistory,
  appendMonthly as appendSunshine, validateMonthlyUpdates as validateSunshineUpdates, parseMonthlyCommand as parseSunshineCommand };
