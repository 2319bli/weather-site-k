export const DATA_FILES = { cet: 'MeanTempCET.csv', ewp: 'PrecipitationEWP.csv', for: 'forecast_2026.csv' };
export function validDate(iso) {
  return typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso) &&
    Number.isFinite(Date.parse(iso)) && new Date(iso).toISOString().slice(0, 10) === iso;
}
export function latestDate(weather, baseline, dataset) {
  return weather.observed[dataset].at(-1)?.iso || baseline[dataset];
}
export function validateUpdates(updates) {
  if (!Array.isArray(updates) || !updates.length || updates.length > 3660) throw new Error('Supply between 1 and 3660 updates.');
  const dates = new Set();
  return updates.map(row => {
    if (!row || !validDate(row.iso) || typeof row.value !== 'number' || !Number.isFinite(row.value) || Math.abs(row.value) > 100000) throw new Error('Each update needs a valid ISO date and a finite numeric value.');
    if (dates.has(row.iso)) throw new Error(`Duplicate date: ${row.iso}.`);
    dates.add(row.iso);
    const valueText = row.valueText === undefined ? String(row.value) : row.valueText;
    if (typeof valueText !== 'string' || !/^-?\d+(\.\d+)?$/.test(valueText) || Number(valueText) !== row.value) throw new Error('Invalid value text.');
    return { iso: row.iso, value: row.value, valueText };
  });
}
export function applyUpdates(weather, baseline, dataset, updates) {
  if (dataset === 'for') {
    const latest = latestDate(weather, baseline, 'cet');
    if (updates.some(row => row.iso <= latest)) throw new Error(`Forecast dates must be after ${latest}.`);
    for (const row of updates) weather.forecast[row.iso] = row.value;
  } else {
    if (!['cet', 'ewp'].includes(dataset)) throw new Error('Dataset must be cet or ewp.');
    const latest = latestDate(weather, baseline, dataset);
    const next = new Date(Date.parse(latest) + 86400000).toISOString().slice(0, 10);
    if (updates[0].iso !== next) throw new Error(`First date must be ${next}. Reload the terminal if another session has updated it.`);
    if (updates.some((row, i) => i && row.iso <= updates[i - 1].iso)) throw new Error('Dates must be in ascending order.');
    weather.observed[dataset].push(...updates);
    if (dataset === 'cet') {
      for (const date of Object.keys(weather.forecast)) if (date <= updates.at(-1).iso) delete weather.forecast[date];
    }
  }
}
export function forecastRows(baselineText, weather, baseline) {
  const rows = new Map(baselineText.trim().split(/\r?\n/).filter(Boolean).map(line => {
    const [iso, value] = line.split(',');
    return [iso, value];
  }));
  for (const [iso, value] of Object.entries(weather.forecast)) rows.set(iso, value);
  const latest = latestDate(weather, baseline, 'cet');
  return [...rows].filter(([iso]) => iso > latest).sort(([a], [b]) => a.localeCompare(b));
}
export function csvText(original, dataset, weather, baseline) {
  if (dataset === 'for' && !weather.observed.cet.length && !Object.keys(weather.forecast).length) return original;
  if (dataset === 'for') return forecastRows(original, weather, baseline).map(row => row.join(',')).join('\n') + '\n';
  const updates = weather.observed[dataset];
  if (!updates.length) return original;
  return original + (original.endsWith('\n') ? '' : '\n') + updates.map(row => `${row.iso},${row.valueText}`).join('\n') + '\n';
}
