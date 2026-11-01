export const SUNSHINE = Object.freeze({
  sunuk: { label: 'UK wide', file: 'UK.txt' },
  suneng: { label: 'England', file: 'England.txt' },
  suneaw: { label: 'England and Wales', file: 'England_and_Wales.txt' },
  sunmid: { label: 'Midlands', file: 'Midlands.txt' }
});
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
export function validateSunshineUpdates(updates) {
  if (!Array.isArray(updates) || !updates.length || updates.length > 120) throw new Error('Supply 1–120 monthly sunshine totals.');
  return updates.map(row => {
    if (!row || !validMonth(row.month)) throw new Error('Use a valid month in YYYY-MM format (1910 onwards).');
    const [year, month] = row.month.split('-').map(Number);
    const maxHours = new Date(Date.UTC(year, month, 0)).getUTCDate() * 24;
    if (typeof row.value !== 'number' || !Number.isFinite(row.value) || row.value < 0 || row.value > maxHours) throw new Error(`Sunshine for ${row.month} must be between 0 and ${maxHours} hours.`);
    return { month: row.month, value: row.value };
  });
}
export function appendSunshine(records, updates) {
  const checked = validateSunshineUpdates(updates);
  let expected = nextMonth(records.at(-1).month);
  for (const row of checked) {
    if (row.month !== expected) throw new Error(`Expected ${expected}; confirmed months must follow the latest month consecutively.`);
    expected = nextMonth(row.month);
  }
  return [...records, ...checked];
}
export function parseSunshine(text) {
  const lines = text.replace(/\r/g, '').split('\n');
  const header = lines.findIndex(line => /^year\s+jan\s+feb\b/.test(line));
  if (header < 0) throw new Error('Sunshine archive header is missing.');
  const columns = [...lines[header].matchAll(/\S+/g)].map(match => ({ key: match[0], end: match.index + match[0].length }));
  if (columns.map(c => c.key).join(' ') !== 'year jan feb mar apr may jun jul aug sep oct nov dec win spr sum aut ann') throw new Error('Unexpected sunshine archive columns.');
  const records = [], published = {};
  let previousYear = null;
  for (const line of lines.slice(header + 1).filter(line => line.trim())) {
    const year = Number(line.slice(0,4));
    if (!/^\d{4}/.test(line) || year < 1910 || (previousYear !== null && year !== previousYear + 1)) throw new Error('Invalid sunshine archive year sequence.');
    previousYear = year;
    published[year] = {};
    for (let i = 1; i < columns.length; i++) {
      // Blank future months retain their fixed-width columns before seasonal totals.
      const cell = line.slice(columns[i-1].end, columns[i].end).trim();
      if (!cell || cell === '---') continue;
      if (!/^\d+(?:\.\d+)?$/.test(cell)) throw new Error(`Invalid sunshine value for ${year} ${columns[i].key}.`);
      const value = Number(cell);
      if (i <= 12) records.push({ month: monthKey(year,i), value });
      else published[year][columns[i].key] = value;
    }
  }
  if (!records.length) throw new Error('Sunshine archive has no observations.');
  return { records, published, sourceUpdated: lines.find(line => line.startsWith('Last updated '))?.slice(13) || '' };
}
export function parseSunshineCommand(command) {
  const match = /^(dat|conf)\s+(sunuk|suneng|suneaw|sunmid)\b\s*([\s\S]*)$/i.exec(command.trim());
  if (!match) return null;
  const action = match[1].toLowerCase(), dataset = match[2].toLowerCase();
  let body = match[3].trim();
  if (action === 'dat') {
    if (body) throw new Error(`Use dat ${dataset} without extra arguments.`);
    return { action, dataset };
  }
  if (body.startsWith('"') && body.endsWith('"')) body = body.slice(1,-1).trim();
  const updates = body.split(/\r?\n/).filter(line => line.trim()).map(line => {
    const row = /^(\d{4}-\d{2})\s+(\d+(?:\.\d+)?)$/.exec(line.trim());
    if (!row) throw new Error('Each line must be YYYY-MM followed by sunshine hours, for example 2026-10 86.3.');
    return { month: row[1], value: Number(row[2]) };
  });
  return { action, dataset, updates: validateSunshineUpdates(updates) };
}
export function sunshineHistory(data, kind, key, toDate = false) {
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
  if (!['months', 'seasons', 'hex'].includes(kind)) throw new Error('Choose months, seasons or hex seasons for an individual breakdown.');
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
