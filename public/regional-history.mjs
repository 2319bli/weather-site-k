import { monthlyDataset, monthlyHistory, parseMonthlyArchive } from './sunshine-data.mjs?v=regional-1';

const feeds = new Map();

async function fetchData(dataset) {
  const info = monthlyDataset(dataset);
  try {
    const response = await fetch(`https://weather-site-k-admin.2319bli.workers.dev/data/${dataset}.json`, { cache: 'no-store' });
    if (!response.ok) throw new Error();
    const data = await response.json();
    if (data.dataset !== dataset || !data.records?.length) throw new Error();
    return { data, bundled: false };
  } catch {
    const response = await fetch(new URL('./data/' + info.archive, import.meta.url));
    if (!response.ok) throw new Error('Could not load the regional archive.');
    return { data: parseMonthlyArchive(await response.text()), bundled: true };
  }
}

export function loadRegionalData(dataset) {
  if (!feeds.has(dataset)) {
    const pending = fetchData(dataset).then(result => {
      if (result.bundled) feeds.delete(dataset);
      return result;
    }).catch(error => { feeds.delete(dataset); throw error; });
    feeds.set(dataset, pending);
  }
  return feeds.get(dataset);
}

export function renderRegionalHistory({ data, bundled, dataset, view, selection, toDate, plot, table, extra, summary, note }) {
  const info = monthlyDataset(dataset);
  const seasons = { winter: 'win', spring: 'spr', summer: 'sum', autumn: 'aut' };
  const key = view === 'seasons' ? seasons[selection] : String(selection);
  const history = monthlyHistory(data, view === 'hex-seasons' ? 'hex' : view, key, toDate);
  const { rows, period, latest, ranked, months } = history;
  const metric = info.series === 'AirFrost' ? 'Air frost days' : 'Rain days ≥1 mm';
  const label = metric + ' · ' + info.label;
  const coverage = row => `${row.count}/${row.expected} months`;
  const detail = row => `${period.label} ${row.year}<br>${row.value.toFixed(1)} days · ${coverage(row)}<br>${row.rank === null ? 'Incomplete period' : 'Rank ' + row.rank + ' of ' + ranked}`;
  const complete = rows.filter(row => row.complete), partial = rows.filter(row => !row.complete);
  const traces = [{ x: rows.map(row => row.year), y: rows.map(row => row.complete ? row.value : null),
    type: 'scatter', mode: 'lines+markers', name: 'Complete periods', line: { color: '#3985cb', width: 1.3 },
    marker: { size: 4 }, connectgaps: false, text: rows.map(detail), hovertemplate: '%{text}<extra></extra>' }];
  function markers(points, name, color, symbol) {
    if (points.length) traces.push({ type: 'scatter', mode: 'markers', name,
      x: points.map(row => row.year), y: points.map(row => row.value),
      marker: { color, size: 9, symbol }, text: points.map(detail), hovertemplate: '%{text}<extra></extra>' });
  }
  markers(partial, 'Incomplete periods', '#d77831', 'diamond-open');
  if (ranked) {
    const lowest = Math.min(...complete.map(row => row.value));
    markers(complete.filter(row => row.rank === 1), 'Most days', '#d77831', 'circle');
    markers(complete.filter(row => row.value === lowest), 'Fewest days', '#35a96f', 'circle');
  }
  plot(traces, `${period.label} · ${label}`, { title: 'Year', dtick: 10, tickformat: 'd' }, 'Days (regional average)');
  note.textContent = toDate && months.length
    ? 'Matching months in each year: ' + months.map(month => new Date(Date.UTC(2000, (month + 11) % 12, 1)).toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' })).join(', ') + '.'
    : '';
  summary.textContent = [months.length ? `${ranked} complete periods.` : `No complete months for ${period.label} ${history.referenceYear} yet.`,
    `${bundled ? 'Bundled archive' : 'Observations'} through ${latest}.`,
    period.months[0] === 0 ? 'Winter includes the preceding December.' : ''].filter(Boolean).join(' ');
  if (rows.length) extra.innerHTML = `<details><summary>All years · values and rankings</summary>${table(
    ['Year', 'Days', 'Coverage', 'Rank (most days first)'], rows.slice().reverse().map(row => [row.year, row.value.toFixed(1), coverage(row), row.rank ?? '—']), label)}</details>`;
  const link = document.createElement('a');
  link.href = info.sourceUrl;
  link.textContent = 'Met Office data';
  summary.append(' ', link);
}
