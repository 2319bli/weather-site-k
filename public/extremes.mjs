export const EXTREME_FILES = { hei: 'hottest_days.csv', fei: 'coldest_days.csv' };
export const EXTREME_URLS = { hei: 'hottest_days.json', fei: 'coldest_days.json' };

export function validateRecords(records) {
  if (!Array.isArray(records) || !records.length || records.length > 1000) throw new Error('Supply between 1 and 1000 annual records.');
  const seen = new Set();
  return records.map(record => {
    const { iso, temperature, location } = record || {};
    if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso) || !Number.isFinite(Date.parse(iso)) || new Date(iso).toISOString().slice(0, 10) !== iso || Number(iso.slice(0, 4)) < 1000) throw new Error('Each record needs a valid full date.');
    const year = Number(iso.slice(0, 4));
    if (seen.has(year)) throw new Error(`Supply one annual record per year: ${year}.`);
    seen.add(year);
    if (typeof temperature !== 'number' || !Number.isFinite(temperature) || temperature < -100 || temperature > 80) throw new Error('Temperature must be a number between -100 and 80°C.');
    if (typeof location !== 'string' || !location.trim() || location.length > 160 || /[\x00-\x1f\x7f]/.test(location)) throw new Error('Each record needs a location of 1–160 characters.');
    return { year, iso, temperature, location: location.trim() };
  });
}

export function parseExtremeCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  const input = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trimEnd() + '\n';
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"') {
      if (quoted && input[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (ch === ',' || ch === '\n')) {
      row.push(field); field = '';
      if (ch === '\n') { rows.push(row); row = []; }
    } else field += ch;
  }
  if (quoted || rows.shift()?.join(',') !== 'Year,Date,Temperature,Location') throw new Error('Invalid annual record CSV.');
  return validateRecords(rows.map(row => {
    if (row.length !== 4 || !/^\d{4}$/.test(row[0]) || !/^\d{2}\/\d{2}$/.test(row[1]) || !/^-?\d+(\.\d+)?$/.test(row[2])) throw new Error('Invalid annual record CSV row.');
    const [day, month] = row[1].split('/');
    return { iso: `${row[0]}-${month}-${day}`, temperature: Number(row[2]), location: row[3] };
  }));
}

export function mergeRecords(original, overrides) {
  const records = new Map(original.map(record => [record.year, record]));
  for (const record of Object.values(overrides)) records.set(record.year, record);
  return [...records.values()].sort((a, b) => a.year - b.year);
}

const dayMs = 86400000;
const dateName = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'long', timeZone: 'UTC' });
const monthName = new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' });
const escapeHtml = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

export function buildIndex(records, dataset) {
  if (!['hei', 'fei'].includes(dataset)) throw new Error('Unknown index.');
  records = validateRecords(records);
  const heat = dataset === 'hei';
  const label = dataset.toUpperCase();
  // Keep the original non-leap day positions; a leap-day record has its own slot.
  const days = Array.from({ length: 365 }, (_, i) => i + 1);
  if (records.some(record => record.iso.slice(5) === '02-29')) days.push(59.5);
  const buckets = new Map(days.sort((a, b) => a - b).map(day => [day, { day, value: 0, records: [] }]));
  for (const record of records) {
    const monthDay = record.iso.slice(5);
    const day = monthDay === '02-29' ? 59.5 : (Date.parse(`2001-${monthDay}`) - Date.UTC(2001, 0, 1)) / dayMs + 1;
    const bucket = buckets.get(day);
    bucket.value += heat ? record.temperature - 27 : -record.temperature - 8;
    bucket.records.push(record);
  }
  // Round accumulated binary floating-point noise, without clamping negative HEI.
  for (const bucket of buckets.values()) bucket.value = Math.round(bucket.value * 1e8) / 1e8;
  const ranked = [...buckets.values()].filter(bucket => bucket.records.length).sort((a, b) => b.value - a.value || a.day - b.day);
  ranked.forEach((bucket, i) => { bucket.rank = i + 1; });
  for (const bucket of buckets.values()) {
    const date = bucket.day === 59.5 ? new Date('2000-02-29') : new Date(Date.UTC(2001, 0, bucket.day));
    bucket.date = dateName.format(date);
    bucket.records.sort((a, b) => a.year - b.year);
    const heading = `<b>${bucket.date}</b><br>Month: ${monthName.format(date)}<br>`;
    if (bucket.records.length) {
      const temperatures = bucket.records.map(record => record.temperature);
      const years = bucket.records.map(record => {
        const excess = heat ? record.temperature - 27 : -record.temperature - 8;
        return `• ${record.year}: ${record.temperature}°C (excess: ${excess >= 0 ? '+' : ''}${excess.toFixed(1)}°C) at ${escapeHtml(record.location)}`;
      }).join('<br>');
      bucket.hover = `${heading}Rank: #${bucket.rank}<br>${label}: ${bucket.value.toFixed(1)}<br>Occurrences: ${bucket.records.length}<br>Temperature range: ${Math.min(...temperatures).toFixed(1)}°C - ${Math.max(...temperatures).toFixed(1)}°C<br><br><b>Years:</b><br>${years}`;
    } else bucket.hover = `${heading}${label}: 0<br>No annual records on this date`;
  }
  const plotted = [...buckets.values()].filter(bucket => heat ? bucket.day >= 91 && bucket.day <= 304 : bucket.day >= 274 || bucket.day <= 120);
  return {
    firstYear: Math.min(...records.map(record => record.year)),
    lastYear: Math.max(...records.map(record => record.year)),
    top: ranked.slice(0, 10),
    trace: {
      type: 'bar', name: label, marker: { color: heat ? 'orangered' : 'steelblue' },
      hovertemplate: '%{text}<extra></extra>',
      x: plotted.map(bucket => !heat && bucket.day <= 120 ? bucket.day + 365 : bucket.day),
      y: plotted.map(bucket => bucket.value), text: plotted.map(bucket => bucket.hover)
    }
  };
}
