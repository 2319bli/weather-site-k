import { buildIndex, EXTREME_URLS } from './extremes.mjs';

const dataset = document.body.dataset.index;
const chart = document.getElementById('index-chart');
const status = document.getElementById('index-status');
const retry = document.getElementById('index-retry');
const table = document.querySelector('.top10-table tbody');
const originalLayout = JSON.parse(document.getElementById('index-layout').textContent);

async function render() {
  status.hidden = false;
  status.textContent = 'Loading data…';
  retry.hidden = true;
  try {
    const response = await fetch(`https://weather-site-k-admin.2319bli.workers.dev/data/${EXTREME_URLS[dataset]}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Data request failed (${response.status}).`);
    const { records, version } = await response.json();
    const index = buildIndex(records, dataset);
    const layout = structuredClone(originalLayout);
    layout.title.text = layout.title.text.replace(/\(\d{4}-\d{4}\)/, `(${index.firstYear}-${index.lastYear})`);
    if (!window.Plotly) throw new Error('The chart library could not be loaded. Refresh to try again.');
    await Plotly.newPlot(chart, [index.trace], layout, { responsive: true });
    table.replaceChildren(...index.top.map((bucket, i) => {
      const row = document.createElement('tr');
      const values = [i + 1, bucket.date, bucket.day === 59.5 ? 'Leap day' : `Day ${bucket.day}`, bucket.value.toFixed(1), bucket.records.length, bucket.records.map(record => record.year).join(', ')];
      values.forEach((value, column) => {
        const cell = document.createElement('td');
        if (column === 0 || column === 3) {
          const strong = document.createElement('strong'); strong.textContent = value; cell.append(strong);
        } else cell.textContent = value;
        row.append(cell);
      });
      return row;
    }));
    chart.dataset.version = String(version);
    window.dispatchEvent(new Event('weather:chart-ready'));
    status.hidden = true;
  } catch (error) {
    status.textContent = error.message || 'Unable to load index data.';
    retry.hidden = false;
  }
}
retry.addEventListener('click', render);
render();
