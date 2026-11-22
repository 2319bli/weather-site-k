// Compose the CET chart locally; projections never enter the observed archive.
(function (root) {
    function outlook(observed, forecasts) {
        const latest = observed.reduce((last, row) => Math.max(last, +row.date), -Infinity);
        const future = new Map();
        for (const row of forecasts) {
            if (+row.date > latest) future.set(+row.date, { ...row, source: 'forecast' });
        }
        const normals = new Map();
        for (const row of observed) {
            if (row.year < 2017 || row.year > 2026) continue;
            const key = row.month * 100 + row.day;
            const normal = normals.get(key) || { sum: 0, count: 0 };
            normal.sum += row.value;
            normal.count++;
            normals.set(key, normal);
        }
        for (let time = Date.UTC(2027, 1, 1); time < Date.UTC(2028, 0, 1); time += 86400000) {
            if (time <= latest || future.has(time)) continue;
            const date = new Date(time), month = date.getUTCMonth() + 1, day = date.getUTCDate();
            const normal = normals.get(month * 100 + day);
            if (!normal) continue;
            future.set(time, { date, month, day, year: 2027, doy: 1 + (time - Date.UTC(2027, 0, 1)) / 86400000,
                label: date.toLocaleDateString('en-GB', {timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric'}),
                value: normal.sum / normal.count, source: 'projection' });
        }
        return [...future.values()].sort((a, b) => a.date - b.date);
    }

    function defaultYear(years, today = new Date()) {
        return Math.max(...[...years].filter(year => year <= today.getUTCFullYear()));
    }

    // Each call starts a new period mean. Split lines wherever their provenance changes.
    function cumulative(entries, year, color, axis, label) {
        const traces = [];
        let sum = 0, previous, latestObserved;
        for (const [index, row] of entries.entries()) {
            sum += row.value;
            const point = { x: axis(row), y: sum / (index + 1), date: row.date, source: row.source, year: row.year, label: row.label };
            const outlookYearChanged = row.source && previous && row.year !== previous.year;
            if (!previous || row.source !== previous.source || outlookYearChanged) {
                const prefix = row.source ? row.year + ' ' + row.source : String(year);
                const method = row.source === 'projection' ? ' · 2017–2026 daily mean' : '';
                const trace = { x: [], y: [], text: [], mode: 'lines', name: prefix + ' (' + label + ')' + method,
                    line: { color, width: 2, dash: row.source === 'projection' ? 'dash' : row.source ? 'dot' : 'solid' },
                    hovertemplate: '%{text}<br>%{y:.2f}°C<extra>%{fullData.name}</extra>' };
                if (previous && row.year === previous.year && row.date - previous.date === 86400000) {
                    trace.x.push(previous.x); trace.y.push(previous.y); trace.text.push(previous.label);
                }
                traces.push(trace);
            }
            const trace = traces.at(-1);
            trace.x.push(point.x); trace.y.push(point.y); trace.text.push(point.label);
            if (!row.source) latestObserved = point;
            previous = point;
        }
        for (const trace of traces) if (trace.x.length === 1) trace.mode = 'markers';
        return { traces, latestObserved, last: previous };
    }

    const api = { outlook, defaultYear, cumulative };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.CETOutlook = api;
})(typeof window !== 'undefined' ? window : globalThis);
