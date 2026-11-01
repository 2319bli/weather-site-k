import { SUNSHINE, PERIODS, MONTHS, sunshineHistory, sunshineBreakdown } from './sunshine-data.mjs?v=2';

const $ = id => document.getElementById(id);
const state = { data: null, kind: 'annual', selected: { annual: 'ann', months: '1', seasons: 'win', hex: 'win' }, windows: {}, modes: {}, request: 0 };
const individualPicker = window.IndividualComparison.createYearPicker($('sunshine-year-control'), 'sunshine', safeRender);
const mobile = window.matchMedia('(max-width: 650px)');
const hours = value => `${value.toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h`;
const monthName = value => `${MONTHS[Number(value.slice(5)) - 1]} ${value.slice(0,4)}`;

function summaryCard(title, value, detail) {
  const card = document.createElement('article');
  for (const [tag,text] of [['h3',title],['strong',value],['p',detail]]) {
    const element = document.createElement(tag); element.textContent = text; card.append(element);
  }
  return card;
}
function renderTable(history) {
  const rows = [...history.rows], order = $('sunshine-sort').value;
  rows.sort((a,b) => order === 'year' ? b.year - a.year : Number(b.complete) - Number(a.complete) || (order === 'high' ? b.value - a.value : a.value - b.value) || b.year - a.year);
  $('sunshine-rows').replaceChildren(...rows.map(row => {
    const tr = document.createElement('tr');
    for (const text of [row.year, row.value.toFixed(1), row.rank ?? 'Unranked', `${row.count}/${row.expected} months${row.complete ? '' : ' · incomplete'}`]) {
      const td = document.createElement('td'); td.textContent = text; tr.append(td);
    }
    return tr;
  }));
  $('sunshine-table-caption').textContent = `${SUNSHINE[$('sunshine-dataset').value].label} · ${history.period.label} · ${history.ranked} complete comparisons`;
}
async function render() {
  if (!state.data) return;
  const individual = state.kind !== 'annual' && state.modes[state.kind] === 'individual';
  $('sunshine-view-controls').hidden = state.kind === 'annual';
  document.querySelectorAll('[data-sunshine-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.sunshineView === (individual ? 'individual' : 'historical'))));
  $('comparison-title').textContent = individual ? 'Individual totals' : 'Historical comparison';
  $('period-control').hidden = individual || state.kind === 'annual';
  $('sunshine-window-control').hidden = individual;
  $('sunshine-year-control').hidden = !individual;
  $('sunshine-history-details').hidden = individual;
  $('sunshine-individual-details').hidden = !individual;
  $('sunshine-summary').hidden = individual;
  $('sunshine-chart').setAttribute('aria-label', individual ? 'Individual sunshine totals' : 'Historical sunshine totals');
  if (individual) return renderIndividual();
  const data = state.data, toDate = $('sunshine-window').value === 'to-date';
  const history = sunshineHistory(data, state.kind, state.selected[state.kind], toDate);
  const complete = history.rows.filter(row => row.complete);
  const latest = history.rows.find(row => row.year === history.referenceYear);
  const label = data.label;
  const months = history.months.map(m => MONTHS[(m + 11) % 12].slice(0,3));
  const monthRange = months.length > 1 ? `${months[0]}–${months.at(-1)}` : months[0];
  $('comparison-window').textContent = history.months.length
    ? `${label} · ${history.period.label}${toDate ? ` · ${monthRange} in every year` : ''}. ${toDate ? `Through the latest confirmed month, ${monthName(history.latest)}. ` : ''}${history.ranked} complete periods ranked.`
    : `No confirmed months for ${history.period.label} in ${history.referenceYear} yet. Select a different period or Full period.`;
  $('sunshine-summary').replaceChildren(summaryCard(String(history.referenceYear), latest ? hours(latest.value) : 'No data', latest ? latest.complete ? `Rank ${latest.rank} of ${history.ranked} · sunniest first` : `${latest.count}/${latest.expected} months · incomplete, unranked` : 'No confirmed months in this comparison.'));
  for (const [title, direction] of [['Sunniest',-1],['Dullest',1]]) {
    const sorted = [...complete].sort((a,b) => direction * (a.value - b.value));
    const best = sorted[0];
    $('sunshine-summary').append(summaryCard(title, best ? hours(best.value) : '—', best ? sorted.filter(row => row.value === best.value).map(row => row.year).join(', ') : 'No complete periods.'));
  }
  renderTable(history);
  $('sunshine-chart').hidden = !history.rows.length;
  if (!history.rows.length) return;
  const style = getComputedStyle(document.documentElement), color = name => style.getPropertyValue(name).trim();
  const accent = color('--nav-active-line'), foreground = color('--text-body');
  const traces = [{
    x: history.rows.map(row => row.year), y: history.rows.map(row => row.complete ? row.value : null),
    type: 'scatter', mode: 'lines+markers', name: 'Complete periods', connectgaps: false,
    line: { color: accent, width: 1.5 }, marker: { color: accent, size: 5 },
    customdata: history.rows.map(row => [row.rank, row.count]),
    hovertemplate: '%{x}: %{y:.1f} hours<br>Rank %{customdata[0]} · %{customdata[1]} months<extra></extra>'
  }];
  const partial = history.rows.filter(row => !row.complete);
  if (partial.length) traces.push({ x: partial.map(row => row.year), y: partial.map(row => row.value), type: 'scatter', mode: 'markers', name: 'Incomplete periods', marker: { symbol: 'diamond-open', size: 11, color: foreground, line: { width: 2 } }, customdata: partial.map(row => `${row.count}/${row.expected}`), hovertemplate: '%{x}: %{y:.1f} hours<br>%{customdata} months · unranked<extra></extra>' });
  if (latest?.complete) traces.push({ x: [latest.year], y: [latest.value], type: 'scatter', mode: 'markers', name: String(latest.year), marker: { symbol: 'star', size: 13, color: foreground }, hovertemplate: `${latest.year}: %{y:.1f} hours<br>Rank ${latest.rank} of ${history.ranked}<extra></extra>` });
  const normal = complete.filter(row => row.year >= 1991 && row.year <= 2020);
  if (normal.length === 30 && history.rows.length) {
    const average = normal.reduce((sum,row) => sum + row.value,0) / normal.length;
    traces.push({ x: [history.rows[0].year, history.rows.at(-1).year], y: [average,average], type: 'scatter', mode: 'lines', name: '1991–2020 average', line: { color: foreground, dash: 'dot', width: 1 }, hovertemplate: '1991–2020 average: %{y:.1f} hours<extra></extra>' });
  }
  if (!window.Plotly) throw new Error('The chart library could not load. Refresh to try again.');
  await Plotly.react($('sunshine-chart'), traces, {
    autosize: true, paper_bgcolor: color('--panel-bg'), plot_bgcolor: color('--panel-bg'),
    font: { family: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif', size: 12, color: foreground },
    margin: { l: 65, r: 20, t: 25, b: 95 }, hovermode: 'closest',
    xaxis: { title: 'Year', tickformat: 'd', gridcolor: color('--panel-border'), zeroline: false },
    yaxis: { title: 'Sunshine (hours)', rangemode: 'tozero', gridcolor: color('--panel-border'), zeroline: false },
    legend: { orientation: 'h', x: 0, y: -0.18, font: { size: 10 } }
  }, { responsive: true, displaylogo: false, modeBarButtonsToRemove: ['select2d','lasso2d'] });
}

async function renderIndividual() {
  const data = state.data;
  const available = [...new Set(data.records.map(row => Number(row.month.slice(0,4))))];
  const latest = data.records.at(-1).month;
  if (state.kind === 'seasons' && latest.endsWith('-12')) available.push(Number(latest.slice(0,4)) + 1);
  available.sort((a,b) => b-a);
  const years = individualPicker.update(available, Number(latest.slice(0,4)));
  const series = years.map(year => ({year, colour: individualPicker.colour(year), rows: sunshineBreakdown(data, state.kind, year)}));
  const rows = series.flatMap(series => series.rows);
  const labels = series[0].rows.map(row => state.kind === 'months' ? row.label.slice(0,3) : row.label.split(' (')[0]);
  const kindLabel = { months: 'Monthly', seasons: 'Seasonal', hex: 'Hex-season' }[state.kind];
  $('comparison-window').textContent = `${data.label} · ${kindLabel} totals. ${series.map(({year,rows}) => `${year}: ${rows.filter(row => row.complete).length}/${rows.length} periods complete`).join(' · ')}.${state.kind === 'seasons' ? ' Winter includes the preceding December.' : ''}${rows.some(row => row.count && !row.complete) ? ' Hatched bars show incomplete totals.' : ''}${rows.some(row => !row.count) ? ' Periods without observations are left blank.' : ''}`;
  $('sunshine-individual-caption').textContent = `${data.label} · ${years.join(', ')} · ${kindLabel} sunshine totals`;
  const tableRows = labels.flatMap((_,i) => series.map(({rows}) => rows[i]));
  $('sunshine-individual-rows').replaceChildren(...tableRows.map(row => {
    const tr = document.createElement('tr');
    for (const text of [row.label, row.year, row.value === null ? '—' : row.value.toFixed(1), `${row.count}/${row.expected} months${row.complete ? '' : row.count ? ' · incomplete' : ' · no observations'}`]) {
      const td = document.createElement('td'); td.textContent = text; tr.append(td);
    }
    return tr;
  }));
  $('sunshine-chart').hidden = false;
  const style = getComputedStyle(document.documentElement), color = name => style.getPropertyValue(name).trim();
  if (!window.Plotly) throw new Error('The chart library could not load. Refresh to try again.');
  await Plotly.react($('sunshine-chart'), window.IndividualComparison.traces(series, 'sunshine', labels, monthName), {
    autosize: true, paper_bgcolor: color('--panel-bg'), plot_bgcolor: color('--panel-bg'),
    font: { family: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif', size: 12, color: color('--text-body') },
    margin: { l: 65, r: 20, t: 25, b: Math.max(115, 85 + Math.ceil(series.length / (mobile.matches ? 2 : 4)) * 22) }, hovermode: 'closest', showlegend: true, barmode: 'group',
    legend: { orientation: 'h', x: 0, y: -0.15, yanchor: 'top', entrywidthmode: 'fraction', entrywidth: mobile.matches ? 0.5 : 0.25, font: {size: 11} },
    xaxis: { type: 'category', categoryorder: 'array', categoryarray: labels, tickangle: 0, tickfont: { size: 10 }, gridcolor: color('--panel-border') },
    yaxis: { title: 'Sunshine (hours)', rangemode: 'tozero', gridcolor: color('--panel-border'), zeroline: false }
  }, { responsive: true, displaylogo: false, modeBarButtonsToRemove: ['select2d','lasso2d'] });
}
function updatePeriodControls() {
  const options = PERIODS[state.kind];
  $('sunshine-period').replaceChildren(...options.map(period => new Option(period.label,period.key)));
  $('sunshine-period').value = state.selected[state.kind];
  $('period-control').hidden = state.kind === 'annual';
  $('sunshine-window').options[1].textContent = state.kind === 'annual' ? 'Year to date' : 'Period to date';
  $('sunshine-window').value = state.windows[state.kind] || 'full';
  document.querySelectorAll('[data-period]').forEach(button => {
    const active = button.dataset.period === state.kind;
    button.classList.toggle('active', active); button.setAttribute('aria-pressed',String(active));
  });
}
async function safeRender() {
  try { await render(); } catch (error) { $('sunshine-status').textContent = error.message; }
}
async function load() {
  const request = ++state.request, dataset = $('sunshine-dataset').value;
  state.data = null; $('sunshine-content').hidden = true;
  $('sunshine-coverage').textContent = '';
  $('sunshine-status').textContent = 'Loading server data…';
  try {
    const response = await fetch(`https://weather-site-k-admin.2319bli.workers.dev/data/${dataset}.json`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Unable to load sunshine data (${response.status}). Use Refresh data to retry.`);
    const data = await response.json();
    if (request !== state.request) return;
    if (!data.records?.length || data.dataset !== dataset) throw new Error('The server returned invalid sunshine data. Refresh to retry.');
    state.data = data;
    $('sunshine-coverage').textContent = `1910–${data.records.at(-1).month.slice(0,4)} · through ${monthName(data.records.at(-1).month)}`;
    $('sunshine-source').href = data.sourceUrl;
    $('sunshine-source').textContent = `${data.label} sunshine data`;
    $('sunshine-source-date').textContent = `Archive updated ${data.sourceUpdated}; later confirmations are stored on the server.`;
    $('sunshine-content').hidden = false;
    await render();
    if (request === state.request) $('sunshine-status').textContent = '';
  } catch (error) { if (request === state.request) $('sunshine-status').textContent = error.message; }
}
document.querySelectorAll('[data-period]').forEach(button => button.addEventListener('click', () => { state.kind = button.dataset.period; updatePeriodControls(); safeRender(); }));
document.querySelectorAll('[data-sunshine-view]').forEach(button => button.addEventListener('click', () => { state.modes[state.kind] = button.dataset.sunshineView; safeRender(); }));
mobile.addEventListener('change', safeRender);
$('sunshine-period').addEventListener('change', () => { state.selected[state.kind] = $('sunshine-period').value; safeRender(); });
$('sunshine-window').addEventListener('change', () => { state.windows[state.kind] = $('sunshine-window').value; safeRender(); });
$('sunshine-sort').addEventListener('change', safeRender);
$('sunshine-dataset').addEventListener('change', load);
$('sunshine-refresh').addEventListener('click', load);
new MutationObserver(safeRender).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
const requestedDataset = new URLSearchParams(location.search).get('dataset');
if (Object.hasOwn(SUNSHINE, requestedDataset)) $('sunshine-dataset').value = requestedDataset;
updatePeriodControls();
load();
