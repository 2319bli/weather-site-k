/* Shared calendar analyses for observed CET and EWP; the original filename is retained for cached pages. */
(function (root) {
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const SEASONS = {
        winter: ['Winter', [12, 1, 2]], spring: ['Spring', [3, 4, 5]],
        summer: ['Summer', [6, 7, 8]], autumn: ['Autumn', [9, 10, 11]]
    };
    const HEX = {
        win: ['Winter', [1, 2]], spr: ['Spring', [3, 4]], pra: ['Prasiner', [5, 6]],
        xan: ['Xanther', [7, 8]], aut: ['Autumn', [9, 10]], pha: ['Phaier', [11, 12]]
    };
    const key = (month, day) => `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const iso = (year, month, day) => `${year}-${key(month, day)}`;
    const daysInMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate();

    function period(view, selection) {
        if (view === 'annual') return { label: 'Annual', months: Array.from({ length: 12 }, (_, i) => i + 1) };
        if (view === 'months') return { label: MONTHS[selection - 1], months: [Number(selection)] };
        const [label, months] = (view === 'seasons' ? SEASONS : HEX)[selection];
        return { label, months, winter: view === 'seasons' && selection === 'winter' };
    }

    // A leap-year calendar aligns 1 March with 1 March in every daily trace.
    // Winter is labelled by its January/February year (December is year - 1).
    function slots(period, year = 2000) {
        const result = [];
        for (const month of period.months) {
            const calendarYear = period.winter && month === 12 ? year - 1 : year;
            for (let day = 1; day <= daysInMonth(calendarYear, month); day++) {
                result.push({ month, day, key: key(month, day), iso: iso(calendarYear, month, day),
                    x: result.length + 1, label: `${day} ${MONTHS[month - 1]}` });
            }
        }
        return result;
    }

    function normalize(row) {
        const date = row.date;
        const year = date.getUTCFullYear(), month = date.getUTCMonth() + 1, day = date.getUTCDate();
        return { year, month, day, key: key(month, day), iso: iso(year, month, day), value: row.value };
    }

    function createArchive(observedRows) {
        const rows = [...new Map(observedRows.map(row => {
            const entry = normalize(row);
            return [entry.iso, entry];
        })).values()].sort((a, b) => a.iso.localeCompare(b.iso));
        const byYear = new Map(), records = new Map();
        for (const row of rows) {
            if (!byYear.has(row.year)) byYear.set(row.year, []);
            byYear.get(row.year).push(row);
            if (!records.has(row.key)) records.set(row.key, { low: Infinity, high: -Infinity, lowYears: [], highYears: [] });
            const record = records.get(row.key);
            for (const [bound, compare] of [['low', (a, b) => a < b], ['high', (a, b) => a > b]]) {
                if (compare(row.value, record[bound])) {
                    record[bound] = row.value;
                    record[`${bound}Years`] = [row.year];
                } else if (row.value === record[bound]) record[`${bound}Years`].push(row.year);
            }
        }
        return { rows, byYear, records, latest: rows.at(-1)?.iso };
    }

    function periodYear(row, period) {
        return row.year + (period.winter && row.month === 12 ? 1 : 0);
    }

    function years(archive, period) {
        return [...new Set(archive.rows.filter(row => period.months.includes(row.month))
            .map(row => periodYear(row, period)))].sort((a, b) => a - b);
    }

    function entries(archive, period, year) {
        const candidates = period.winter
            ? [...(archive.byYear.get(year - 1) || []), ...(archive.byYear.get(year) || [])]
            : archive.byYear.get(year) || [];
        return candidates.filter(row => period.months.includes(row.month) && periodYear(row, period) === year);
    }

    function daily(archive, period, selectedYears, forecastRows = []) {
        const calendar = slots(period);
        const forecast = forecastRows.map(normalize).filter(row => row.iso > archive.latest);
        const series = selectedYears.map(year => {
            const observed = new Map(entries(archive, period, year).map(row => [row.key, row]));
            const predicted = new Map(forecast.filter(row => period.months.includes(row.month) && periodYear(row, period) === year)
                .map(row => [row.key, row]));
            return { year, observed: calendar.map(day => observed.get(day.key) || null),
                forecast: calendar.map(day => predicted.get(day.key) || null) };
        });
        return { calendar, series, records: calendar.map(day => archive.records.get(day.key) || null) };
    }

    function heldRecords(archive, period, year) {
        const positions = new Map(slots(period).map(day => [day.key, day.x]));
        const held = [];
        for (const row of entries(archive, period, year)) {
            const record = archive.records.get(row.key);
            for (const [bound, kind] of [['high', 'Warmest'], ['low', 'Coldest']]) {
                if (row.value === record[bound]) held.push({ ...row, x: positions.get(row.key), kind, bound,
                    years: record[`${bound}Years`], tied: record[`${bound}Years`].length > 1 });
            }
        }
        return held;
    }

    function history(archive, period, aggregation = 'mean') {
        const result = years(archive, period).map(year => {
            const rows = entries(archive, period, year);
            const expected = slots(period, year).length;
            const total = rows.reduce((sum, row) => sum + row.value, 0);
            const mean = total / rows.length;
            return { year, mean, total, value: aggregation === 'total' ? total : mean,
                days: rows.length, expected, complete: rows.length === expected,
                first: rows[0].iso, last: rows.at(-1).iso, rank: null };
        });
        return rankHistory(result);
    }

    function rankHistory(result) {
        const ranked = result.filter(row => row.complete).sort((a, b) => b.value - a.value);
        ranked.forEach((row, index) => {
            row.rank = index && Math.abs(row.value - ranked[index - 1].value) < 1e-10 ? ranked[index - 1].rank : index + 1;
        });
        return result;
    }

    // Compare identical calendar dates, not day-of-year numbers. February 29
    // is omitted in every year; a missing observation leaves the year unranked.
    function historyToDate(archive, period, aggregation = 'mean') {
        const latest = archive.rows.at(-1);
        if (!latest) return { rows: [], referenceYear: null, cutoff: null, start: null, end: null, expected: 0 };
        const referenceYear = periodYear(latest, period);
        const calendar = slots(period, referenceYear).filter(day => day.iso <= latest.iso && day.key !== '02-29');
        const window = { referenceYear, cutoff: latest.iso, start: calendar[0]?.iso ?? null,
            end: calendar.at(-1)?.iso ?? null, expected: calendar.length };
        if (!calendar.length) return { ...window, rows: [] };
        const keys = new Set(calendar.map(day => day.key));
        const candidates = [...new Set([...years(archive, period).filter(year => year <= referenceYear), referenceYear])].sort((a, b) => a - b);
        const rows = candidates.map(year => {
            const observed = entries(archive, period, year).filter(row => keys.has(row.key));
            const total = observed.length ? observed.reduce((sum, row) => sum + row.value, 0) : null;
            const mean = observed.length ? total / observed.length : null;
            const candidateDate = day => iso(period.winter && day.month === 12 ? year - 1 : year, day.month, day.day);
            return { year, mean, total, value: aggregation === 'total' ? total : mean,
                days: observed.length, expected: calendar.length, complete: observed.length === calendar.length,
                first: observed[0]?.iso ?? null, last: observed.at(-1)?.iso ?? null,
                windowStart: candidateDate(calendar[0]), windowEnd: candidateDate(calendar.at(-1)), rank: null };
        });
        return { ...window, rows: rankHistory(rows) };
    }

    const api = { period, slots, createArchive, years, entries, daily, heldRecords, history, historyToDate };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.WeatherAnalysis = root.CETAnalysis = api;
})(typeof window !== 'undefined' ? window : globalThis);
