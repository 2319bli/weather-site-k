/* Presentation only: retain saved theme IDs and leave chart/data code alone. */
(() => {
  const themes = ['kimi-1', 'kimi-2', 'kimi-3', 'codex-1', 'codex-2', 'codex-3', 'claude-1', 'claude-2', 'claude-3'];
  const seasonal = document.documentElement.hasAttribute('data-seasonal');
  if (seasonal) themes.push('seasonal');
  const validPeriod = value => /^(?:[1-9]|[12]\d|3[0-6])$/.test(value);
  let theme = seasonal ? 'seasonal' : 'codex-2';
  let period = null;
  const url = new URL(location.href);
  const requested = seasonal ? url.searchParams.get('season') : null;
  try {
    const saved = localStorage.getItem('weather-site-theme');
    if (themes.includes(saved)) theme = saved;
    const sample = sessionStorage.getItem('weather-season-preview');
    if (seasonal && validPeriod(sample)) { period = sample; theme = 'seasonal'; }
  } catch { /* The picker also works without browser storage. */ }

  function saveChoice() {
    try {
      if (seasonal) {
        if (period === null) sessionStorage.removeItem('weather-season-preview');
        else sessionStorage.setItem('weather-season-preview', period);
      }
      if (period === null) localStorage.setItem('weather-site-theme', theme);
    } catch { /* Use the selection for the current page. */ }
  }
  if (validPeriod(requested) || requested === 'auto') {
    theme = 'seasonal';
    period = validPeriod(requested) ? requested : null;
    saveChoice();
    url.searchParams.delete('season');
    history.replaceState(history.state, '', url);
  }
  document.documentElement.dataset.theme = theme;
  document.addEventListener('DOMContentLoaded', () => {
    const select = document.getElementById('theme-toggle');
    if (!select) return;
    select.value = theme;
    let seasonalView;
    function applyTheme() {
      document.documentElement.dataset.theme = theme;
      if (theme === 'seasonal' && !seasonalView) {
        seasonalView = import('./seasonal-site.mjs').then(({ startSeasonal }) =>
          startSeasonal(() => period, () => {
            period = null;
            saveChoice();
            applyTheme();
          })
        );
      } else if (seasonalView) {
        seasonalView.then(render => render());
      }
    }
    applyTheme();
    select.addEventListener('change', () => {
      theme = select.value;
      period = null;
      saveChoice();
      applyTheme();
    });
    // Keep the existing series colours while making each year label readable.
    const contrastYearLabels = list => list.querySelectorAll('li').forEach(item => {
      const channels = getComputedStyle(item).backgroundColor.match(/[\d.]+/g);
      if (!channels || channels.length < 3) return;
      const linear = channels.slice(0, 3).map(value => {
        const channel = Number(value) / 255;
        return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
      });
      const luminance = linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
      item.style.color = luminance > .179 ? '#000000' : '#ffffff';
    });
    document.querySelectorAll('.year-list').forEach(list => {
      new MutationObserver(() => contrastYearLabels(list)).observe(list, {childList: true});
      contrastYearLabels(list);
    });
    // Fit HEI/FEI charts to the panel, including after their server data arrives.
    const charts = [...document.querySelectorAll('.plotly-graph-div')];
    const widths = new WeakMap();
    const originalLayouts = new WeakMap();
    const resize = () => charts.forEach(chart => {
      if (!chart.data || !window.Plotly) return;
      if (!originalLayouts.has(chart)) originalLayouts.set(chart, {
        title: chart.layout.title.text,
        titleSize: chart.layout.title.font?.size || 18,
        left: chart.layout.margin?.l ?? 80,
        right: chart.layout.margin?.r ?? 80,
        top: chart.layout.margin?.t ?? 100
      });
      const width = Math.round(chart.getBoundingClientRect().width);
      const height = Math.round(chart.getBoundingClientRect().height);
      const size = `${width}:${height}`;
      if (width > 0 && widths.get(chart) !== size) {
        widths.set(chart, size);
        const original = originalLayouts.get(chart);
        const compact = width < 600;
        Plotly.relayout(chart, {
          width, height, autosize: true,
          'title.text': compact
            ? original.title.replace(' by Day of Year ', '<br>By day of year ').replace(' for each day across all years', '<br>for each day across all years')
            : original.title,
          'title.font.size': compact ? 14 : original.titleSize,
          'margin.l': compact ? 50 : original.left,
          'margin.r': compact ? 20 : original.right,
          'margin.t': compact ? 120 : original.top
        });
      }
    });
    if (charts.length) {
      const observer = new ResizeObserver(resize);
      charts.forEach(chart => observer.observe(chart));
      window.addEventListener('load', resize, {once:true});
      window.addEventListener('weather:chart-ready', () => {
        charts.forEach(chart => { widths.delete(chart); originalLayouts.delete(chart); });
        resize();
      });
      resize();
    }
  });
})();
