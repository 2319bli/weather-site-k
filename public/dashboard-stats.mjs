const DAY = 86400000;
const isoDate = date => date.toISOString().slice(0, 10);

export function parseObservations(csv) {
  const lines = csv.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  if (!/^date,value$/i.test(lines.shift()?.trim())) throw new Error('Unrecognised observation file.');
  const seen = new Set();
  const rows = lines.filter(line => line.trim()).map(line => {
    const [rawDate, rawValue, extra] = line.split(',');
    const date = rawDate.trim();
    const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date);
    const iso = dmy ? `${dmy[3]}-${dmy[2]}-${dmy[1]}` : date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || !Number.isFinite(Date.parse(iso)) || isoDate(new Date(iso)) !== iso || extra !== undefined || !rawValue?.trim() || !Number.isFinite(Number(rawValue))) throw new Error('Invalid date or value in the observations.');
    if (seen.has(iso)) throw new Error(`Duplicate observation: ${iso}.`);
    seen.add(iso);
    return { iso, year: Number(iso.slice(0, 4)), value: Number(rawValue) };
  });
  if (!rows.length) throw new Error('No observations available.');
  return rows.sort((a, b) => a.iso.localeCompare(b.iso));
}

export function createArchive(rows, kind) {
  if (!['cet', 'ewp'].includes(kind)) throw new Error('Unknown observation series.');
  const years = new Map();
  for (const row of rows) {
    if (!years.has(row.year)) years.set(row.year, new Map());
    years.get(row.year).set(row.iso.slice(5), row.value);
  }
  return { rows, kind, years, availableYears: [...years.keys()].sort((a, b) => a - b) };
}

// Every comparison uses the same month/day slots, omitting 29 February.
// Relative years preserve the preceding December in January's 30-day window.
export function dateSlots(year, start, end) {
  const slots = [];
  for (let time = Date.parse(start); time <= Date.parse(end); time += DAY) {
    const iso = isoDate(new Date(time));
    if (iso.slice(5) !== '02-29') slots.push({ offset: Number(iso.slice(0, 4)) - year, day: iso.slice(5) });
  }
  return slots;
}

export function comparePeriod(archive, year, start, end) {
  const slots = dateSlots(year, start, end);
  const measure = values => archive.kind === 'cet' ? values.reduce((a, b) => a + b, 0) / values.length : values.reduce((a, b) => a + b, 0);
  const valuesFor = candidate => slots.map(slot => archive.years.get(candidate + slot.offset)?.get(slot.day)).filter(Number.isFinite);
  const current = valuesFor(year);
  const complete = slots.length > 0 && current.length === slots.length;
  const history = archive.availableYears.flatMap(candidate => {
    const values = valuesFor(candidate);
    return slots.length && values.length === slots.length ? [{ year: candidate, value: measure(values) }] : [];
  });
  const baseline = history.filter(row => row.year >= 1991 && row.year <= 2020);
  const normal = baseline.length ? baseline.reduce((sum, row) => sum + row.value, 0) / baseline.length : null;
  const value = current.length ? measure(current) : null;
  const delta = complete && normal !== null ? value - normal : null;
  return {
    start, end, value, normal, delta, complete, count: current.length, expected: slots.length,
    baselineCount: baseline.length,
    percent: delta !== null && normal !== 0 ? value / normal * 100 : null,
    rankHigh: complete ? 1 + history.filter(row => row.value > value + 1e-8).length : null,
    rankLow: complete ? 1 + history.filter(row => row.value < value - 1e-8).length : null,
    tied: complete && history.filter(row => Math.abs(row.value - value) <= 1e-8).length > 1,
    yearsCompared: history.length,
    firstYear: history[0]?.year,
    lastYear: history.at(-1)?.year
  };
}

export function longestDryRun(rows) {
  let run = null, best = { days: 0, start: null, end: null };
  for (const row of rows) {
    if (row.value >= 1) { run = null; continue; }
    if (!run || Date.parse(row.iso) - Date.parse(run.end) !== DAY) run = { days: 0, start: row.iso, end: row.iso };
    run.days++; run.end = row.iso;
    if (run.days > best.days) best = { ...run };
  }
  return best;
}

export function summariseYear(archive, year) {
  const rows = archive.rows.filter(row => row.year === year);
  if (!rows.length) return null;
  const latest = rows.at(-1);
  const start = `${year}-01-01`;
  const recentStart = isoDate(new Date(Date.parse(latest.iso) - 29 * DAY));
  const months = Array.from({ length: 12 }, (_, i) => {
    const monthStart = `${year}-${String(i + 1).padStart(2, '0')}-01`;
    if (monthStart > latest.iso) return null;
    const monthEnd = isoDate(new Date(Date.UTC(year, i + 1, 0)));
    return comparePeriod(archive, year, monthStart, monthEnd < latest.iso ? monthEnd : latest.iso);
  });
  return {
    year, latest, ytd: comparePeriod(archive, year, start, latest.iso),
    recent: comparePeriod(archive, year, recentStart, latest.iso), months,
    highest: rows.reduce((best, row) => row.value > best.value ? row : best),
    lowest: rows.reduce((best, row) => row.value < best.value ? row : best),
    dryRun: archive.kind === 'ewp' ? longestDryRun(rows) : null
  };
}

export function ordinal(value) {
  const mod100 = value % 100;
  const suffix = mod100 >= 11 && mod100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[value % 10] || 'th');
  return `${value}${suffix}`;
}
