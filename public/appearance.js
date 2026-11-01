/* Presentation only: retain saved theme IDs and leave chart/data code alone. */
(() => {
  const themes = ['kimi-1', 'kimi-2', 'kimi-3', 'codex-1', 'codex-2', 'codex-3', 'claude-1', 'claude-2', 'claude-3'];
  let theme = 'codex-2';
  try {
    const saved = localStorage.getItem('weather-site-theme');
    if (themes.includes(saved)) theme = saved;
  } catch { /* The selected theme still works without browser storage. */ }
  document.documentElement.dataset.theme = theme;
  document.addEventListener('DOMContentLoaded', () => {
    const select = document.getElementById('theme-toggle');
    select.value = theme;
    select.addEventListener('change', () => {
      document.documentElement.dataset.theme = select.value;
      try { localStorage.setItem('weather-site-theme', select.value); } catch { /* Current visit only. */ }
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
    // The exported HEI/FEI charts have a fixed 1400px layout. Fit their existing
    // traces to the available panel; the original data and plotting scripts stay intact.
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
      resize();
    }
  });
})();
