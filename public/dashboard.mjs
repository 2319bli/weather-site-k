import { parseObservations, createArchive, summariseYear, ordinal } from './dashboard-stats.mjs';

const base = 'https://weather-site-k-admin.2319bli.workers.dev';
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const shortFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const date = iso => dateFormat.format(new Date(iso));
const shortDate = iso => shortFormat.format(new Date(iso));
const numeric = (value, digits = 1) => value === null || value === undefined ? '—' : value.toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const signed = value => `${value >= 0 ? '+' : '−'}${numeric(Math.abs(value), 2)}`;
const $ = selector => document.querySelector(selector);
const state = { archives: {}, annual: {}, summaries: {}, year: null, metric: 'cet' };

function element(tag, text, className) {
  const result = document.createElement(tag);
  if (text !== undefined) result.textContent = text;
  if (className) result.className = className;
  return result;
}
function field(container, name, text) { container.querySelector(`[data-field="${name}"]`).textContent = text; }
function metricValue(period, kind) { return period?.value === null || !period ? '—' : `${numeric(period.value, kind === 'cet' ? 2 : 1)} ${kind === 'cet' ? '°C' : 'mm'}`; }
function comparison(period, kind) {
  if (!period) return 'No observations for this year.';
  if (!period.complete) return `Incomplete observations: ${period.count} of ${period.expected} comparable days`;
  if (period.delta === null) return 'Reference average unavailable';
  return kind === 'cet' ? `${signed(period.delta)}°C vs 1991–2020` : period.percent === null ? 'Reference rainfall is zero' : `${numeric(period.percent)}% of 1991–2020 rainfall`;
}
function periodText(period) {
  return `${shortDate(period.start)} – ${date(period.end)}${period.start.slice(0, 4) !== period.end.slice(0, 4) ? ` (starts ${period.start.slice(0, 4)})` : ''}`;
}
function renderSummary(kind) {
  const model = state.summaries[kind];
  const panel = $(`#${kind}-summary`);
  const period = model?.ytd;
  field(panel, 'value', '—');
  if (period?.value !== null && period) {
    panel.querySelector('[data-field="value"]').replaceChildren(document.createTextNode(numeric(period.value, kind === 'cet' ? 2 : 1)), element('span', kind === 'cet' ? '°C' : 'mm'));
  }
  field(panel, 'comparison', comparison(period, kind));
  field(panel, 'normal', period?.normal !== null && period ? `1991–2020 average: ${numeric(period.normal, kind === 'cet' ? 2 : 1)} ${kind === 'cet' ? '°C' : 'mm'}${period.baselineCount !== 30 ? ` (${period.baselineCount} complete years)` : ''}` : '');
  let rank = 'Ranking unavailable';
  if (period?.complete) {
    const dry = kind === 'ewp' && period.normal !== null && period.value < period.normal;
    rank = `${period.tied ? 'Joint ' : ''}${ordinal(dry ? period.rankLow : period.rankHigh)} ${kind === 'cet' ? 'warmest' : dry ? 'driest' : 'wettest'} of ${period.yearsCompared} years`;
  }
  field(panel, 'rank', rank);
  field(panel, 'archive', period?.complete ? `Archive: ${period.firstYear}–${period.lastYear}` : '');
  field(panel, 'period', period ? `${periodText(period)} · ${period.count} comparable days` : '');
  const recent = $(`#${kind}-recent`);
  field(recent, 'value', metricValue(model?.recent, kind));
  field(recent, 'comparison', comparison(model?.recent, kind));
  field(recent, 'period', model ? periodText(model.recent) : '');
}

function renderHighlights() {
  const cet = state.summaries.cet;
  const ewp = state.summaries.ewp;
  const highlights = [
    ['Highest daily mean · CET', cet ? `${numeric(cet.highest.value)}°C` : '—', cet ? date(cet.highest.iso) : 'No observations'],
    ['Lowest daily mean · CET', cet ? `${numeric(cet.lowest.value)}°C` : '—', cet ? date(cet.lowest.iso) : 'No observations'],
    ['Wettest day · EWP', ewp ? `${numeric(ewp.highest.value, 2)} mm` : '—', ewp ? date(ewp.highest.iso) : 'No observations'],
    ['Longest run below 1 mm · EWP', ewp ? `${ewp.dryRun.days} days` : '—', ewp?.dryRun.days ? `${shortDate(ewp.dryRun.start)} – ${date(ewp.dryRun.end)}` : ewp ? 'No days below 1 mm' : 'No observations']
  ];
  $('#daily-highlights').replaceChildren(...highlights.map(([heading, value, detail]) => {
    const card = element('article', undefined, 'highlight-card');
    card.append(element('h3', heading), element('p', value, 'medium-number'), element('p', detail, 'muted'));
    return card;
  }));
  $('#annual-extremes').replaceChildren(...['hei', 'fei'].map(kind => {
    const record = state.annual[kind]?.find(row => row.year === state.year);
    const card = element('article', undefined, 'dashboard-panel annual-card');
    const heading = element('div', undefined, 'card-heading');
    const link = element('a', kind === 'hei' ? 'Heat index ↗' : 'Freeze index ↗'); link.href = `${kind}.html`;
    heading.append(element('h3', kind === 'hei' ? 'Hottest annual record' : 'Coldest annual record'), link);
    card.append(heading, element('p', record ? `${numeric(record.temperature)}°C` : '—', 'medium-number'),
      element('p', record ? `${date(record.iso)} · ${record.location}` : state.annual[kind] ? `No annual record for ${state.year}` : 'Annual record unavailable', 'muted'));
    return card;
  }));
}

function renderMonthlyTable() {
  $('#monthly-rows').replaceChildren(...months.map((name, i) => {
    const cet = state.summaries.cet?.months[i];
    const ewp = state.summaries.ewp?.months[i];
    const row = element('tr');
    const monthCell = element('th', name); monthCell.scope = 'row';
    const partial = [cet, ewp].filter(Boolean).some(period => new Date(Date.parse(period.end) + 86400000).getUTCDate() !== 1);
    if (partial) { monthCell.textContent += ' *'; monthCell.title = [cet && `CET through ${shortDate(cet.end)}`, ewp && `EWP through ${shortDate(ewp.end)}`].filter(Boolean).join('; '); }
    const values = [metricValue(cet, 'cet'), cet?.delta !== null && cet ? `${signed(cet.delta)}°C` : '—', metricValue(ewp, 'ewp'), ewp?.percent !== null && ewp ? `${numeric(ewp.percent)}%` : '—'];
    row.append(monthCell, ...values.map(value => element('td', value)));
    return row;
  }));
}

function svgElement(tag, attributes = {}, text) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}
function renderChart() {
  const container = $('#monthly-chart');
  if (!container.clientWidth) return;
  const model = state.summaries[state.metric];
  const heat = state.metric === 'cet';
  $('#chart-caption').textContent = `${heat ? 'CET departure from' : 'EWP as a percentage of'} 1991–2020.${model ? ` Latest month through ${shortDate(model.latest.iso)}.` : ''}`;
  const width = container.clientWidth, height = 285;
  const pad = { left: 45, right: 10, top: 27, bottom: 35 };
  const values = months.map((_, i) => {
    const period = model?.months[i];
    return period?.complete ? (heat ? period.delta : period.percent) : null;
  });
  const measured = values.filter(value => value !== null);
  const min = heat ? Math.floor(Math.min(-.5, ...measured) * 2) / 2 : 0;
  const max = heat ? Math.ceil(Math.max(.5, ...measured) * 2) / 2 : Math.ceil(Math.max(150, ...measured) / 50) * 50;
  const y = value => pad.top + (max - value) / (max - min) * (height - pad.top - pad.bottom);
  const step = (width - pad.left - pad.right) / 12;
  const baseline = heat ? 0 : 100;
  const svg = svgElement('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': `${state.year} monthly ${heat ? 'temperature departures' : 'rainfall compared with average'}. Exact values are in Monthly figures.` });
  svg.append(svgElement('title', {}, `${state.year} month-by-month comparison`));
  for (const tick of [min, baseline, max]) {
    svg.append(svgElement('line', { x1: pad.left, x2: width - pad.right, y1: y(tick), y2: y(tick), class: tick === baseline ? 'reference-line' : 'grid-line' }));
    svg.append(svgElement('text', { x: pad.left - 7, y: y(tick) + 4, 'text-anchor': 'end' }, heat ? `${tick > 0 ? '+' : ''}${numeric(tick, 1)}°` : `${Math.round(tick)}%`));
  }
  months.forEach((month, i) => {
    const x = pad.left + i * step;
    const period = model?.months[i];
    const group = svgElement('g', { class: 'month-item' });
    if (values[i] !== null) {
      const value = values[i], from = 0;
      const description = `${month}: ${metricValue(period, state.metric)}. ${comparison(period, state.metric)}. ${periodText(period)}.`;
      group.setAttribute('tabindex', '0'); group.setAttribute('aria-label', description);
      group.append(svgElement('title', {}, description));
      group.append(svgElement('rect', { x: x + step * .2, y: Math.min(y(value), y(from)), width: step * .6, height: Math.max(1, Math.abs(y(value) - y(from))), rx: 2, class: `bar${value < baseline ? ' bar-below' : ''}` }));
    } else group.append(svgElement('text', { x: x + step / 2, y: y(0) - 10, 'text-anchor': 'middle' }, '—'));
    group.append(svgElement('text', { x: x + step / 2, y: height - 11, 'text-anchor': 'middle' }, month));
    svg.append(group);
  });
  container.replaceChildren(svg);
}

function render() {
  state.summaries = Object.fromEntries(['cet', 'ewp'].map(kind => [kind, state.archives[kind] ? summariseYear(state.archives[kind], state.year) : null]));
  const available = Object.values(state.summaries).filter(Boolean);
  const ongoing = available.some(model => model.latest.iso.slice(5) !== '12-31');
  $('#overview-title').textContent = `${state.year} ${ongoing ? 'so far' : 'overview'}`;
  document.title = `${state.year} overview | Weather Site K`;
  $('#coverage').textContent = available.length === 2 && available[0].latest.iso === available[1].latest.iso
    ? `Observations through ${date(available[0].latest.iso)}`
    : ['cet', 'ewp'].map(kind => state.summaries[kind] ? `${kind === 'cet' ? 'CET' : 'EWP'} through ${date(state.summaries[kind].latest.iso)}` : `${kind.toUpperCase()}: no observations for this year`).join(' · ');
  $('#dashboard-content').hidden = false;
  renderSummary('cet'); renderSummary('ewp'); renderHighlights(); renderMonthlyTable(); renderChart();
}

async function loadData() {
  const refresh = $('#refresh'); refresh.disabled = true;
  $('#load-status').textContent = 'Loading server data…';
  const sources = { cet: 'MeanTempCET.csv', ewp: 'PrecipitationEWP.csv', hei: 'hottest_days.json', fei: 'coldest_days.json' };
  const results = await Promise.allSettled(Object.entries(sources).map(async ([kind, file]) => {
    const response = await fetch(`${base}/data/${file}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${kind.toUpperCase()} data unavailable (${response.status})`);
    return kind === 'cet' || kind === 'ewp' ? createArchive(parseObservations(await response.text()), kind) : (await response.json()).records;
  }));
  state.archives = {}; state.annual = {};
  const errors = [];
  Object.keys(sources).forEach((kind, i) => {
    const result = results[i];
    if (result.status === 'fulfilled') {
      if (kind === 'cet' || kind === 'ewp') state.archives[kind] = result.value;
      else state.annual[kind] = result.value;
    } else errors.push(`${kind.toUpperCase()}: ${result.reason.message}`);
  });
  const years = [...new Set(Object.values(state.archives).flatMap(archive => archive.availableYears))].sort((a, b) => b - a);
  if (years.length) {
    if (!years.includes(state.year)) state.year = years[0];
    $('#overview-year').replaceChildren(...years.map(year => { const option = element('option', String(year)); option.value = year; return option; }));
    $('#overview-year').value = state.year; $('#overview-year').disabled = false;
    render();
  } else { $('#dashboard-content').hidden = true; $('#overview-year').disabled = true; $('#coverage').textContent = 'Observations unavailable'; }
  $('#load-status').textContent = errors.length ? `${errors.join('. ')}. Use Refresh data to retry.` : '';
  refresh.disabled = false;
}

$('#refresh').addEventListener('click', loadData);
$('#overview-year').addEventListener('change', event => { state.year = Number(event.target.value); render(); });
document.querySelectorAll('[data-metric]').forEach(button => button.addEventListener('click', () => {
  state.metric = button.dataset.metric;
  document.querySelectorAll('[data-metric]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  renderChart();
}));
new ResizeObserver(renderChart).observe($('#monthly-chart'));
loadData();
