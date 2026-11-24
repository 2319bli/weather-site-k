import { drawLandscape } from './seasonal-landscape.mjs';
import { plates, spotColours, cardPrint } from './seasonal-art.mjs';

const london = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});
const monthName = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'long' });

export function seasonalDate(date = new Date()) {
  const parts = Object.fromEntries(
    london.formatToParts(date).map(({ type, value }) => [type, Number(value)]),
  );
  const index = (parts.month - 1) * 3 + Math.min(2, Math.floor((parts.day - 1) / 10));
  return { index, year: parts.year };
}

export function seasonalRange(index, year) {
  const month = Math.floor(index / 3);
  const end = new Date(Date.UTC(year, month + 1, 0));
  return ['1–10', '11–20', '21–' + end.getUTCDate()][index % 3] + ' ' + monthName.format(end);
}

function mix(a, b, weight) {
  return (
    '#' +
    [0, 2, 4]
      .map((offset) => {
        const channel = (colour) => parseInt(colour.slice(offset, offset + 2), 16);
        return Math.round(channel(a) * (1 - weight) + channel(b) * weight)
          .toString(16)
          .padStart(2, '0');
      })
      .join('')
  );
}

export function startSeasonal(preview, returnToCalendar) {
  const root = document.documentElement;
  const strip = document.createElement('section');
  strip.className = 'season-strip';
  strip.setAttribute('aria-label', 'Seasonal theme');
  strip.innerHTML =
    '<a aria-label="Browse seasonal calendar"></a><button type="button">Use current season</button>';
  document.querySelector('.site-nav').before(strip);
  strip.querySelector('button').onclick = returnToCalendar;
  const scene = document.createElement('canvas');
  scene.className = 'season-landscape';
  scene.setAttribute('aria-hidden', 'true');
  document.body.prepend(scene);
  const prints = Array.from(document.querySelectorAll('.summary-grid .summary-card'), (card) => {
    const canvas = document.createElement('canvas');
    canvas.className = 'instrument';
    canvas.setAttribute('aria-hidden', 'true');
    card.append(canvas);
    return canvas;
  });
  let lastIndex, lastSize, timer;
  function resize() {
    const size = scene.clientWidth + 'x' + scene.clientHeight;
    if (scene.clientWidth && size !== lastSize && lastIndex !== undefined) {
      lastSize = size;
      drawLandscape(scene, lastIndex);
    }
  }
  function render() {
    clearTimeout(timer);
    if (root.dataset.theme !== 'seasonal') return;
    const { index: current, year } = seasonalDate();
    const selected = preview();
    const index = selected === null ? current : Number(selected) - 1;
    strip.querySelector('button').hidden = selected === null;
    if (index !== lastIndex) {
      lastIndex = index;
      lastSize = null;
      const colours = plates[index];
      const [sky, light, far, mid, ink] = colours.split(' ');
      const palette = {
        page: mix(sky, 'fff9ed', 0.84),
        paper: mix(light, 'ffffff', 0.85),
        wash: mix(far, 'fffaf1', 0.74),
        edge: mix(mid, 'fffaf1', 0.64),
        ink: mix(ink, '102020', 0.18),
        muted: mix(ink, '53605c', 0.28),
        accent: '#' + spotColours[index],
      };
      for (const [key, value] of Object.entries(palette)) root.style.setProperty('--ss-' + key, value);
      strip.querySelector('a').href = 'seasonal.html#theme-' + (index + 1);
      prints.forEach((canvas, metric) => cardPrint(canvas, metric, index));
    }
    const range = seasonalRange(index, year);
    strip.querySelector('a').textContent = range;
    strip.querySelector('a').setAttribute('aria-label', range + ' · Browse seasonal calendar');
    resize();
    // UK midnight always falls on a UTC hour, including during British Summer Time.
    timer = setTimeout(render, 3600000 - (Date.now() % 3600000) + 50);
  }
  new ResizeObserver(resize).observe(scene);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) render();
  });
  window.addEventListener('pageshow', render);
  render();
  return render;
}
