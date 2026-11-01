/* Static-host data access. Public CSVs are immutable; edits belong to this browser. */
(() => {
  'use strict';
  const prefix = 'weather-lab:' + new URL('../', document.currentScript.src).pathname;
  const files = { cet: 'MeanTempCET.csv', ewp: 'PrecipitationEWP.csv', for: 'forecast_2026.csv' };
  const cache = new Map();
  // Preserve the original terminal's explicit day-first/ISO parsing. The CET
  // archive contains both formats; native locale parsing is ambiguous.
  function isoDate(value) {
    const text = value.trim();
    const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (!dmy && !iso) return null;
    const year = Number(dmy ? dmy[3] : iso[1]);
    const month = Number(dmy ? dmy[2] : iso[2]);
    const day = Number(dmy ? dmy[1] : iso[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return date.toISOString().slice(0, 10);
  }
  function get(key) {
    try { return localStorage.getItem(prefix + key); } catch { return null; }
  }
  function set(key, value) {
    try { localStorage.setItem(prefix + key, value); }
    catch { throw new Error('Browser storage is unavailable. Allow site storage to save edits.'); }
  }
  function updates(key) {
    try {
      const value = JSON.parse(get('edits:' + key) || '{}');
      if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
      return Object.fromEntries(Object.entries(value).filter(([iso, number]) =>
        /^\d{4}-\d{2}-\d{2}$/.test(iso) && typeof number === 'number' && Number.isFinite(number)));
    } catch { return {}; }
  }
  function saveUpdates(key, values) { set('edits:' + key, JSON.stringify(values)); }
  async function rawText(path) {
    if (!cache.has(path)) {
      cache.set(path, fetch(path).then(response => {
        if (!response.ok) throw new Error(`Unable to load ${path} (${response.status}). Please reload.`);
        return response.text();
      }).catch(error => { cache.delete(path); throw error; }));
    }
    return cache.get(path);
  }
  async function loadText(path) {
    const key = Object.keys(files).find(key => path.endsWith(files[key]));
    const text = await rawText(path);
    if (!key) return text;
    const rows = new Map();
    for (const line of text.replace(/^\uFEFF/, '').trim().split(/\r?\n/)) {
      const [dateText, value] = line.split(',');
      const iso = isoDate(dateText);
      if (iso && value?.trim() && Number.isFinite(Number(value))) {
        rows.set(iso, Number(value));
      }
    }
    Object.entries(updates(key)).forEach(([iso, value]) => rows.set(iso, value));
    if (key === 'for') {
      const observed = await loadText(path.replace(files.for, files.cet));
      const latest = observed.trim().split('\n').at(-1).split(',')[0];
      for (const iso of rows.keys()) if (iso <= latest) rows.delete(iso);
    }
    const lines = [...rows].sort(([a], [b]) => a.localeCompare(b)).map(([iso, value]) => `${iso},${value}`);
    return (key === 'for' ? '' : 'Date,Value\n') + lines.join('\n') + '\n';
  }
  window.WeatherData = { get, set, updates, saveUpdates, loadText };
})();
