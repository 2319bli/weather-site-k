import { plates, spotColours, drawPlate, cardPrint } from './seasonal-art.mjs';
import { seasonalDate, seasonalRange } from './seasonal-site.mjs';
const archive = {
  series: [
    [3.41, 5.3, 7.93, 10.87, 13.22, 17.01, 18.43, 17.7, 14.1, 11.26, 8.38, 6.69],
    [110.64, 57.2, 16.92, 37.48, 32.75, 55.23, 62.23, 34.26, 108.18, 90.05, 146.49, 111.87],
    [61.5, 67.2, 157.1, 227.7, 266.2, 192.9, 182.3, 179.8, 140.0, 63.0, 60.6, 46.5],
  ],
  totals: [11.224931506849316, 863.3, 1644.8],
};
const monthNames = Array.from({ length: 12 }, (_, i) =>
  new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' }).format(Date.UTC(2024, i, 12)),
);
const $ = (id) => document.getElementById(id);
const { index: current, year } = seasonalDate();
function label(index) {
  return seasonalRange(index, year).split(' ')[0];
}
let active = current,
  metric = 0;
const tiles = [];
function hex(s) {
  return '#' + s;
}
function mix(a, b, t) {
  return (
    '#' +
    [0, 2, 4]
      .map((p) =>
        Math.round(parseInt(a.slice(p, p + 2), 16) * (1 - t) + parseInt(b.slice(p, p + 2), 16) * t)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
function chart() {
  const canvas = $('chart'),
    w = canvas.clientWidth,
    h = 110;
  if (!w) return;
  const d = window.devicePixelRatio || 1;
  canvas.width = w * d;
  canvas.height = h * d;
  const c = canvas.getContext('2d');
  c.scale(d, d);
  const [, highlight, , middle, ink] = plates[active][1].split(' '),
    values = archive.series[metric],
    max = Math.ceil(Math.max(...values) / (metric === 0 ? 5 : 50)) * (metric === 0 ? 5 : 50);
  const x = (i) => 36 + ((i + 0.5) * (w - 42)) / 12,
    y = (v) => 83 - (v / max) * 68;
  c.font = '10px system-ui';
  c.textAlign = 'right';
  c.fillStyle = hex(ink);
  for (const v of [0, max / 2, max]) {
    c.fillText(String(v), 28, y(v) + 3);
    c.strokeStyle = mix(ink, 'ffffff', 0.78);
    c.beginPath();
    c.moveTo(33, y(v));
    c.lineTo(w - 3, y(v));
    c.stroke();
  }
  if (metric === 0) {
    c.beginPath();
    values.forEach((v, i) => (i ? c.lineTo(x(i), y(v)) : c.moveTo(x(i), y(v))));
    c.strokeStyle = hex(spotColours[active]);
    c.lineWidth = 2.5;
    c.stroke();
    const area = new Path2D();
    area.moveTo(x(0), 83);
    values.forEach((v, i) => area.lineTo(x(i), y(v)));
    area.lineTo(x(11), 83);
    area.closePath();
    const wash = c.createLinearGradient(0, 15, 0, 83);
    wash.addColorStop(0, hex(spotColours[active]) + '44');
    wash.addColorStop(1, hex(spotColours[active]) + '05');
    c.fillStyle = wash;
    c.fill(area);
    values.forEach((v, i) => {
      c.fillStyle = hex(highlight);
      c.beginPath();
      c.arc(x(i), y(v), 3, 0, 6.283);
      c.fill();
      c.strokeStyle = hex(ink);
      c.lineWidth = 1.5;
      c.stroke();
    });
  } else {
    const bar = Math.min(27, (w - 42) / 19);
    values.forEach((v, i) => {
      c.fillStyle = hex(spotColours[active]);
      c.fillRect(x(i) - bar / 2, y(v), bar, 83 - y(v));
      c.fillStyle = hex(ink);
      c.fillRect(x(i) - bar / 2, y(v), bar, 2);
    });
  }
  c.fillStyle = hex(ink);
  c.textAlign = 'center';
  monthNames.forEach((m, i) => c.fillText(w < 510 ? m[0] : m.slice(0, 3), x(i), 101));
  canvas.setAttribute('role', 'img');
  canvas.setAttribute(
    'aria-label',
    [
      'Monthly CET in degrees Celsius',
      'Monthly England and Wales rainfall in millimetres',
      'Monthly UK sunshine in hours',
    ][metric] +
      ', 2025: ' +
      values.map((v, i) => monthNames[i] + ' ' + v.toFixed(1)).join(', '),
  );
  document.querySelectorAll('[data-m]').forEach((b, i) => b.setAttribute('aria-pressed', i === metric));
}
function paintMark(i, col) {
  const c = $('mark').getContext('2d');
  c.clearRect(0, 0, 200, 20);
  c.fillStyle = col;
  c.strokeStyle = col;
  c.lineWidth = 2;
  const count = 5 + (i % 6);
  for (let n = 0; n < count; n++) {
    const x = 3 + n * 16;
    c.beginPath();
    if ([0, 2, 4, 6, 10, 17, 18, 19, 21, 25, 26, 33].includes(i)) {
      c.moveTo(x, 15);
      c.lineTo(x + 10, 4);
      c.stroke();
    } else if ([3, 5, 9, 11, 13, 16, 20, 23, 27, 28].includes(i)) {
      c.ellipse(x + 5, 10, 6, 3, -0.6, 0, 6.283);
      c.fill();
    } else {
      c.moveTo(x, 12);
      c.quadraticCurveTo(x + 5, 3, x + 13, 10);
      c.stroke();
    }
  }
}
function select(i, store = true) {
  active = (i + 36) % 36;
  const m = Math.floor(active / 3);
  $('month').value = m;
  $('third').replaceChildren(...[0, 1, 2].map((k) => new Option(label(m * 3 + k), k)));
  $('third').value = active % 3;
  const [name, cols] = plates[active],
    [sky, highlight, far, mid, ink] = cols.split(' ');
  const dark = [2, 4, 11, 15, 19, 22, 24, 29, 31, 34, 35].includes(active);
  $('site-preview').href = 'index.html?season=' + (active === current ? 'auto' : active + 1);
  const root = document.documentElement;
  Object.entries({
    accent: hex(spotColours[active]),
    page: mix(sky, 'fffbec', 0.82),
    wash: mix(far, 'fffaea', 0.73),
    paper: mix(sky, 'fffdf6', 0.84),
    type: mix(ink, '102020', 0.38),
    edge: mix(mid, 'fffdf6', 0.51),
    plate: dark ? hex(ink) : mix(sky, 'fffaf0', 0.43),
    letter: dark ? '#fff8e9' : mix(ink, '172526', 0.35),
  }).forEach(([k, v]) => root.style.setProperty('--' + k, v));
  $('title').textContent = name;
  $('period').textContent = label(active) + ' ' + monthNames[m];
  drawPlate($('hero'), active);
  paintMark(active, dark ? hex(highlight) : hex(ink));
  document.querySelectorAll('.stat .instrument').forEach((canvas, i) => cardPrint(canvas, i, active));
  tiles.forEach((b, j) => b.setAttribute('aria-pressed', active === j));
  chart();
  if (store) history.replaceState(null, '', '#theme-' + (active + 1));
}
for (let m = 0; m < 12; m++) {
  $('month').add(new Option(monthNames[m], m));
  $('jump').add(new Option(monthNames[m], m));
  const block = document.createElement('div');
  block.className = 'month-block';
  block.id = 'month-' + m;
  const title = document.createElement('h3');
  title.textContent = monthNames[m];
  block.append(title);
  for (let k = 0; k < 3; k++) {
    const i = m * 3 + k,
      b = document.createElement('button');
    tiles[i] = b;
    b.className = 'tile';
    b.innerHTML = '<canvas aria-hidden="true"></canvas><strong></strong><small></small>';
    b.querySelector('strong').textContent = plates[i][0];
    b.querySelector('small').textContent = label(i) + ' ' + monthNames[m];
    b.addEventListener('click', () => {
      select(i);
      $('preview').scrollIntoView();
      $('month').focus({ preventScroll: true });
    });
    block.append(b);
  }
  $('calendar').append(block);
}
tiles.forEach((b, i) => {
  if (b.isConnected) drawPlate(b.querySelector('canvas'), i);
});
$('jump').onchange = (e) => {
  if (e.target.value !== '') $('month-' + e.target.value).scrollIntoView();
  e.target.value = '';
};
$('prev').onclick = () => select(active - 1);
$('next').onclick = () => select(active + 1);
$('today').onclick = () => select(current);
$('month').onchange = () => select(Number($('month').value) * 3 + (active % 3));
$('third').onchange = () => select(Math.floor(active / 3) * 3 + Number($('third').value));
document.querySelectorAll('[data-m]').forEach(
  (b, i) =>
    (b.onclick = () => {
      metric = i;
      chart();
    }),
);
document.querySelectorAll('.stat').forEach((stat) => {
  const canvas = document.createElement('canvas');
  canvas.className = 'instrument';
  canvas.setAttribute('aria-hidden', 'true');
  stat.append(canvas);
});
for (const [i, id] of ['t', 'r', 's'].entries())
  $(id).innerHTML =
    archive.totals[i].toLocaleString('en-GB', { maximumFractionDigits: 1, minimumFractionDigits: 1 }) +
    ' <small>' +
    ['°C', 'mm', 'h'][i] +
    '</small>';
function fromHash() {
  const n = /^#theme-(\d+)$/.exec(location.hash);
  return n && +n[1] >= 1 && +n[1] <= 36 ? +n[1] - 1 : current;
}
select(fromHash(), false);
window.addEventListener('hashchange', () => {
  if (location.hash.startsWith('#theme-')) select(fromHash(), false);
});
new ResizeObserver(() => {
  drawPlate($('hero'), active);
  chart();
}).observe($('hero'));
