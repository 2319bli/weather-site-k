const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.worker-assets');
fs.mkdirSync(path.join(output, 'data'), { recursive: true });
for (const file of ['site.css', 'theme.css', 'appearance.js', 'logo.svg',
  'data/MeanTempCET.csv', 'data/PrecipitationEWP.csv', 'data/forecast_2026.csv']) {
  fs.copyFileSync(path.join(root, 'public', file), path.join(output, file));
}
const latest = {};
for (const [key, file] of Object.entries({ cet: 'MeanTempCET.csv', ewp: 'PrecipitationEWP.csv' })) {
  const dates = fs.readFileSync(path.join(output, 'data', file), 'utf8').trim().split(/\r?\n/).slice(1).map(line => {
    const date = line.split(',')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date);
    if (!match) throw new Error(`Unrecognised archive date: ${date}`);
    return `${match[3]}-${match[2]}-${match[1]}`;
  });
  latest[key] = dates.sort().at(-1);
}
fs.writeFileSync(path.join(root, 'worker/baseline.json'), JSON.stringify(latest, null, 2) + '\n');
console.log('Worker assets prepared; historical CSV bytes preserved.');
