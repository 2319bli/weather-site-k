import { plates, spotColours, drawPlate, cardPrint } from './seasonal-art.mjs';

const london = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});
const monthName = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'long' });
const darkBanners = new Set([2, 4, 11, 15, 19, 22, 24, 29, 31, 34, 35]);

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
    '<div><span class="season-period"></span><strong></strong><a>Browse themes ↗</a><button type="button">Use current season</button></div><canvas aria-hidden="true"></canvas>';
  document.querySelector('.site-nav').before(strip);
  strip.querySelector('button').onclick = returnToCalendar;
  const scene = strip.querySelector('canvas');
  const prints = Array.from(document.querySelectorAll('.summary-grid .summary-card'), (card) => {
    const canvas = document.createElement('canvas');
    canvas.className = 'instrument';
    canvas.setAttribute('aria-hidden', 'true');
    card.append(canvas);
    return canvas;
  });
  let lastIndex, lastWidth, timer;
  function resize() {
    const width = scene.clientWidth;
    if (width && width !== lastWidth && lastIndex !== undefined) {
      lastWidth = width;
      drawPlate(scene, lastIndex);
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
      lastWidth = 0;
      const [name, colours] = plates[index];
      const [sky, light, far, mid, ink] = colours.split(' ');
      const dark = darkBanners.has(index);
      const palette = {
        page: mix(sky, 'fff9ed', 0.84),
        paper: mix(light, 'ffffff', 0.85),
        wash: mix(far, 'fffaf1', 0.74),
        edge: mix(mid, 'fffaf1', 0.64),
        ink: mix(ink, '102020', 0.18),
        muted: mix(ink, '53605c', 0.28),
        accent: '#' + spotColours[index],
        banner: dark ? '#' + ink : mix(sky, 'fff8e7', 0.27),
        letter: dark ? '#fff9e8' : '#' + ink,
      };
      for (const [key, value] of Object.entries(palette)) root.style.setProperty('--ss-' + key, value);
      strip.querySelector('strong').textContent = name;
      strip.querySelector('a').href = 'seasonal.html#theme-' + (index + 1);
      prints.forEach((canvas, metric) => cardPrint(canvas, metric, index));
    }
    strip.querySelector('span').textContent = seasonalRange(index, year);
    resize();
    // UK midnight always falls on a UTC hour, including during British Summer Time.
    timer = setTimeout(render, 3600000 - (Date.now() % 3600000) + 50);
  }
  new ResizeObserver(resize).observe(strip);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) render();
  });
  window.addEventListener('pageshow', render);
  render();
  return render;
}
