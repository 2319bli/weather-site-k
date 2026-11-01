(() => {
  const toggle = document.getElementById('theme-toggle');
  if (!toggle) return;
  const saved = WeatherData.get('theme');
  const allowed = Array.from(toggle.options, option => option.value);
  const theme = allowed.includes(saved) ? saved : 'kimi-1';
  document.documentElement.dataset.theme = theme;
  toggle.value = theme;
  toggle.addEventListener('change', () => {
    document.documentElement.dataset.theme = toggle.value;
    try { WeatherData.set('theme', toggle.value); } catch { /* Still apply for this visit. */ }
  });
})();
