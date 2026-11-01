(function () {
        const CSV_PATH = "data/PrecipitationEWP.csv";
        let TARGET_DATE = null;
        const MAX_YEARS = 10;
        const COLOR_PALETTE = [
            "#ff4136", "#ff851b", "#ffd700", "#39ff14", "#006400",
            "#00ced1", "#1f77ff", "#4b0082", "#8000ff", "#ff69b4"
        ];
        const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        function dayOfYear(date) {
            const start = Date.UTC(date.getUTCFullYear(), 0, 0);
            return Math.floor((date - start) / 86400000);
        }

        function parseDateFlexible(text) {
            if (!text) return null;
            const trimmed = text.trim();
            if (trimmed.includes("-")) {
                const iso = new Date(trimmed + "T00:00:00Z");
                return Number.isNaN(iso.getTime()) ? null : iso;
            }
            if (trimmed.includes("/")) {
                const [day, month, year] = trimmed.split("/").map((part) => parseInt(part, 10));
                if (Number.isInteger(day) && Number.isInteger(month) && Number.isInteger(year)) {
                    const date = new Date(Date.UTC(year, month - 1, day));
                    return Number.isNaN(date.getTime()) ? null : date;
                }
            }
            return null;
        }

        function buildMonthShapes(monthStarts, targetDoy) {
            const shapes = monthStarts.map((doy) => ({
                type: "line",
                x0: doy,
                x1: doy,
                y0: 0,
                y1: 1,
                xref: "x",
                yref: "paper",
                line: { color: "rgba(150,150,150,0.35)", width: 1, dash: "dot" }
            }));
            shapes.push({
                type: "line",
                x0: targetDoy,
                x1: targetDoy,
                y0: 0,
                y1: 1,
                xref: "x",
                yref: "paper",
                line: { color: "green", width: 2 }
            });
            return shapes;
        }

        async function loadCsvRows(path) {
            const text = await WeatherData.loadText(path);
            const lines = text.trim().split(/\r?\n/);
            const firstLine = lines[0];
            if (firstLine && /date/i.test(firstLine.split(",")[0])) {
                lines.shift();
            }
            return lines.map((line) => {
                if (!line.trim()) return null;
                const [dateStr, valueStr] = line.split(",");
                const date = parseDateFlexible(dateStr);
                const value = parseFloat(valueStr);
                if (!date || Number.isNaN(value)) return null;
                return { date, value, year: date.getUTCFullYear(), doy: dayOfYear(date) };
            }).filter(Boolean);
        }

        function latestDateForYear(rows, year) {
            const entries = rows
                .filter((row) => row.year === year)
                .slice()
                .sort((a, b) => a.date - b.date);
            return entries.length ? new Date(entries[entries.length - 1].date) : null;
        }

        function rankedYearsFromTotals(yearTotals, mode) {
            const currentYear = new Date().getUTCFullYear();
            if (mode === "recent") {
                return yearTotals
                    .slice()
                    .sort((a, b) => b.year - a.year)
                    .slice(0, MAX_YEARS)
                    .map((y) => y.year);
            }
            if (mode === "wettest") {
                yearTotals.sort((a, b) => b.total - a.total);
                const top = yearTotals.filter((y) => y.year !== currentYear).slice(0, 9).map((y) => y.year);
                return [...top, currentYear].slice(0, MAX_YEARS);
            }
            if (mode === "driest") {
                yearTotals.sort((a, b) => a.total - b.total);
                const top = yearTotals.filter((y) => y.year !== currentYear).slice(0, 9).map((y) => y.year);
                return [...top, currentYear].slice(0, MAX_YEARS);
            }
            yearTotals.sort((a, b) => b.total - a.total);
            const filtered = yearTotals.filter((y) => y.year !== currentYear);
            const wet = filtered.slice(0, 5).map((y) => y.year);
            const dry = filtered.slice().reverse().slice(0, 4).map((y) => y.year);
            return [...wet, ...dry, currentYear].slice(0, MAX_YEARS);
        }

        function getAnnualPresetYears(rows, mode) {
            const byYear = new Map();
            rows.forEach((row) => {
                if (!byYear.has(row.year)) byYear.set(row.year, []);
                byYear.get(row.year).push(row);
            });
            const yearTotals = [];
            byYear.forEach((entries, year) => {
                yearTotals.push({ year, total: entries.reduce((sum, e) => sum + e.value, 0) });
            });
            return rankedYearsFromTotals(yearTotals, mode);
        }

        function getMonthlyPresetYears(rows, month, mode) {
            const byYear = new Map();
            rows.forEach((row) => {
                const m = new Date(row.date).getUTCMonth() + 1;
                if (m !== month) return;
                if (!byYear.has(row.year)) byYear.set(row.year, []);
                byYear.get(row.year).push(row);
            });
            const yearTotals = [];
            byYear.forEach((entries, year) => {
                yearTotals.push({ year, total: entries.reduce((sum, e) => sum + e.value, 0) });
            });
            return rankedYearsFromTotals(yearTotals, mode);
        }

        const SEASONS = {
            winter: { label: "Winter", months: [12, 1, 2], ticktext: ["Dec", "Jan", "Feb"] },
            spring: { label: "Spring", months: [3, 4, 5], ticktext: ["Mar", "Apr", "May"] },
            summer: { label: "Summer", months: [6, 7, 8], ticktext: ["Jun", "Jul", "Aug"] },
            autumn: { label: "Autumn", months: [9, 10, 11], ticktext: ["Sep", "Oct", "Nov"] }
        };

        function seasonYearForDate(date, season) {
            const year = date.getUTCFullYear();
            const month = date.getUTCMonth() + 1;
            if (season === "winter") {
                if (month === 12) return year + 1;
                if (month === 1 || month === 2) return year;
                return null;
            }
            return SEASONS[season].months.includes(month) ? year : null;
        }

        function daysInUTCMonth(year, month) {
            return new Date(Date.UTC(year, month, 0)).getUTCDate();
        }

        function seasonDayIndex(date, season) {
            const year = date.getUTCFullYear();
            const month = date.getUTCMonth() + 1;
            const day = date.getUTCDate();
            if (season === "winter") {
                if (month === 12) return day;
                if (month === 1) return 31 + day;
                if (month === 2) return 31 + 31 + day;
                return null;
            }
            const months = SEASONS[season].months;
            const idx = months.indexOf(month);
            if (idx === -1) return null;
            let offset = 0;
            for (let i = 0; i < idx; i += 1) {
                offset += daysInUTCMonth(year, months[i]);
            }
            return offset + day;
        }

        function seasonMonthStarts(year, season) {
            if (season === "winter") return [1, 32, 63];
            const months = SEASONS[season].months;
            const starts = [1];
            for (let i = 1; i < months.length; i += 1) {
                let start = 1;
                for (let j = 0; j < i; j += 1) start += daysInUTCMonth(year, months[j]);
                starts.push(start);
            }
            return starts;
        }

        function maxSeasonDay(year, season) {
            if (season === "winter") return 31 + 31 + daysInUTCMonth(year, 2);
            return SEASONS[season].months.reduce((sum, month) => sum + daysInUTCMonth(year, month), 0);
        }

        function entriesForSeason(year, season, rows) {
            return rows
                .filter((row) => seasonYearForDate(new Date(row.date), season) === year)
                .slice()
                .sort((a, b) => seasonDayIndex(new Date(a.date), season) - seasonDayIndex(new Date(b.date), season));
        }

        function getSeasonPresetYears(rows, season, mode) {
            const yearTotals = [];
            const years = new Set(rows.map((row) => seasonYearForDate(new Date(row.date), season)).filter(Boolean));
            years.forEach((year) => {
                const entries = entriesForSeason(year, season, rows);
                if (!entries.length) return;
                yearTotals.push({ year, total: entries.reduce((sum, entry) => sum + entry.value, 0) });
            });
            return rankedYearsFromTotals(yearTotals, mode);
        }

        const HEX_SEASONS = {
            win: { label: "Winter", months: [1, 2], ticktext: ["Jan", "Feb"] },
            spr: { label: "Spring", months: [3, 4], ticktext: ["Mar", "Apr"] },
            pra: { label: "Prasiner", months: [5, 6], ticktext: ["May", "Jun"] },
            xan: { label: "Xanther", months: [7, 8], ticktext: ["Jul", "Aug"] },
            aut: { label: "Autumn", months: [9, 10], ticktext: ["Sep", "Oct"] },
            pha: { label: "Phaier", months: [11, 12], ticktext: ["Nov", "Dec"] }
        };

        function hexSeasonYearForDate(date, season) {
            const month = date.getUTCMonth() + 1;
            return HEX_SEASONS[season].months.includes(month) ? date.getUTCFullYear() : null;
        }

        function hexSeasonDayIndex(date, season) {
            const month = date.getUTCMonth() + 1;
            const day = date.getUTCDate();
            const months = HEX_SEASONS[season].months;
            const idx = months.indexOf(month);
            if (idx === -1) return null;
            let offset = 0;
            for (let i = 0; i < idx; i += 1) offset += daysInUTCMonth(date.getUTCFullYear(), months[i]);
            return offset + day;
        }

        function hexSeasonMonthStarts(year, season) {
            const months = HEX_SEASONS[season].months;
            return [1, 1 + daysInUTCMonth(year, months[0])];
        }

        function maxHexSeasonDay(year, season) {
            return HEX_SEASONS[season].months.reduce((sum, month) => sum + daysInUTCMonth(year, month), 0);
        }

        function entriesForHexSeason(year, season, rows) {
            return rows
                .filter((row) => hexSeasonYearForDate(new Date(row.date), season) === year)
                .slice()
                .sort((a, b) => hexSeasonDayIndex(new Date(a.date), season) - hexSeasonDayIndex(new Date(b.date), season));
        }

        function getHexSeasonPresetYears(rows, season, mode) {
            const yearTotals = [];
            const years = new Set(rows.map((row) => hexSeasonYearForDate(new Date(row.date), season)).filter(Boolean));
            years.forEach((year) => {
                const entries = entriesForHexSeason(year, season, rows);
                if (!entries.length) return;
                yearTotals.push({ year, total: entries.reduce((sum, entry) => sum + entry.value, 0) });
            });
            return rankedYearsFromTotals(yearTotals, mode);
        }

        function toDateKeyUTC(date) {
            const y = date.getUTCFullYear();
            const m = String(date.getUTCMonth() + 1).padStart(2, "0");
            const d = String(date.getUTCDate()).padStart(2, "0");
            return y + "-" + m + "-" + d;
        }

        function monthDayKeyUTC(date) {
            const m = String(date.getUTCMonth() + 1).padStart(2, "0");
            const d = String(date.getUTCDate()).padStart(2, "0");
            return m + "-" + d;
        }

        function buildProjectionForYear(rows, targetYear, lookbackYears) {
            const previousStart = targetYear - lookbackYears;
            const priorRows = rows.filter((r) => r.year >= previousStart && r.year < targetYear);
            if (!priorRows.length) {
                return { lastActualDate: null, projectedRows: [] };
            }

            const byMonthDay = new Map();
            let overallTotal = 0;
            priorRows.forEach((r) => {
                const key = monthDayKeyUTC(r.date);
                if (!byMonthDay.has(key)) byMonthDay.set(key, []);
                byMonthDay.get(key).push(r.value);
                overallTotal += r.value;
            });
            const overallMean = overallTotal / priorRows.length;

            const actualRows = rows
                .filter((r) => r.year === targetYear)
                .slice()
                .sort((a, b) => a.date - b.date);
            if (!actualRows.length) {
                return { lastActualDate: null, projectedRows: [] };
            }

            const lastActualDate = new Date(actualRows[actualRows.length - 1].date);
            const projectedRows = [];
            let cursor = new Date(Date.UTC(targetYear, lastActualDate.getUTCMonth(), lastActualDate.getUTCDate() + 1));
            const endOfYear = new Date(Date.UTC(targetYear, 11, 31));
            while (cursor <= endOfYear) {
                const key = monthDayKeyUTC(cursor);
                const values = byMonthDay.get(key);
                const mean = values && values.length
                    ? values.reduce((s, v) => s + v, 0) / values.length
                    : overallMean;
                projectedRows.push({
                    date: new Date(cursor),
                    value: mean,
                    year: targetYear,
                    doy: dayOfYear(cursor),
                    projected: true
                });
                cursor = new Date(Date.UTC(targetYear, cursor.getUTCMonth(), cursor.getUTCDate() + 1));
            }
            return { lastActualDate, projectedRows };
        }

        loadCsvRows(CSV_PATH).then((rows) => {
            const availableYears = new Set(rows.map((r) => r.year));
            const latestYear = Math.max(...Array.from(availableYears));
            TARGET_DATE = latestDateForYear(rows, latestYear) ||
                (rows.length ? new Date(rows[rows.length - 1].date) : new Date());

            const state = {
                rows,
                currentView: "annual",
                annualMode: "wettest",
                monthlyMode: "wettest",
                seasonMode: "wettest",
                hexSeasonMode: "wettest",
                selectedMonth: 12,
                selectedSeason: "winter",
                selectedHexSeason: "xan",
                years: getAnnualPresetYears(rows, "wettest").filter((y) => availableYears.has(y)),
                monthlyYears: null,
                seasonYears: null,
                hexSeasonYears: null,
                latestYear,
                projection: null
            };
            state.years.sort((a, b) => b - a);
            state.projection = buildProjectionForYear(state.rows, state.latestYear, 30);

            const chartEl = document.getElementById("chart");
            const summaryEl = document.getElementById("target-summary");
            const listEl = document.getElementById("year-list");
            const form = document.getElementById("year-form");
            const input = document.getElementById("year-input");
            const errorEl = document.getElementById("year-error");
            const monthSelect = document.getElementById("month-select");
            const seasonSelect = document.getElementById("season-select");
            const hexSeasonSelect = document.getElementById("hex-season-select");
            const listElMonthly = document.getElementById("year-list-monthly");
            const formMonthly = document.getElementById("year-form-monthly");
            const inputMonthly = document.getElementById("year-input-monthly");
            const errorElMonthly = document.getElementById("year-error-monthly");
            const listElSeason = document.getElementById("year-list-season");
            const formSeason = document.getElementById("year-form-season");
            const inputSeason = document.getElementById("year-input-season");
            const errorElSeason = document.getElementById("year-error-season");
            const listElHexSeason = document.getElementById("year-list-hex-season");
            const formHexSeason = document.getElementById("year-form-hex-season");
            const inputHexSeason = document.getElementById("year-input-hex-season");
            const errorElHexSeason = document.getElementById("year-error-hex-season");

            function updateModeButtons(selector, mode) {
                document.querySelectorAll(selector).forEach((btn) => {
                    if (btn.dataset.mode === mode) {
                        btn.style.background = "#4CAF50";
                        btn.style.color = "white";
                        btn.style.borderColor = "#4CAF50";
                    } else {
                        btn.style.background = "#f0f0f0";
                        btn.style.color = "black";
                        btn.style.borderColor = "#ccc";
                    }
                });
            }

            function renderYearList() {
                listEl.innerHTML = "";
                state.years.forEach((year, idx) => {
                    const li = document.createElement("li");
                    const color = COLOR_PALETTE[idx] || "#666";
                    li.style.background = color;
                    li.style.border = "1px solid " + color;
                    li.textContent = year;
                    const btn = document.createElement("button");
                    btn.setAttribute("type", "button");
                    btn.textContent = "x";
                    btn.addEventListener("click", () => {
                        state.years = state.years.filter((y) => y !== year);
                        renderYearList();
                        if (state.currentView === "annual") renderAnnualChart();
                    });
                    li.appendChild(btn);
                    listEl.appendChild(li);
                });
            }

            function renderMonthlyYearList() {
                listElMonthly.innerHTML = "";
                const years = state.monthlyYears || [];
                years.forEach((year, idx) => {
                    const li = document.createElement("li");
                    const color = COLOR_PALETTE[idx] || "#666";
                    li.style.background = color;
                    li.style.border = "1px solid " + color;
                    li.textContent = year;
                    const btn = document.createElement("button");
                    btn.setAttribute("type", "button");
                    btn.textContent = "x";
                    btn.addEventListener("click", () => {
                        state.monthlyYears = (state.monthlyYears || []).filter((y) => y !== year);
                        renderMonthlyYearList();
                        if (state.currentView === "months") renderMonthlyChart();
                    });
                    li.appendChild(btn);
                    listElMonthly.appendChild(li);
                });
            }

            function renderSeasonYearList() {
                listElSeason.innerHTML = "";
                const years = state.seasonYears || [];
                years.forEach((year, idx) => {
                    const li = document.createElement("li");
                    const color = COLOR_PALETTE[idx] || "#666";
                    li.style.background = color;
                    li.style.border = "1px solid " + color;
                    li.textContent = year;
                    const btn = document.createElement("button");
                    btn.setAttribute("type", "button");
                    btn.textContent = "x";
                    btn.addEventListener("click", () => {
                        state.seasonYears = (state.seasonYears || []).filter((y) => y !== year);
                        renderSeasonYearList();
                        if (state.currentView === "seasons") renderSeasonChart();
                    });
                    li.appendChild(btn);
                    listElSeason.appendChild(li);
                });
            }

            function renderHexSeasonYearList() {
                listElHexSeason.innerHTML = "";
                const years = state.hexSeasonYears || [];
                years.forEach((year, idx) => {
                    const li = document.createElement("li");
                    const color = COLOR_PALETTE[idx] || "#666";
                    li.style.background = color;
                    li.style.border = "1px solid " + color;
                    li.textContent = year;
                    const btn = document.createElement("button");
                    btn.setAttribute("type", "button");
                    btn.textContent = "x";
                    btn.addEventListener("click", () => {
                        state.hexSeasonYears = (state.hexSeasonYears || []).filter((y) => y !== year);
                        renderHexSeasonYearList();
                        if (state.currentView === "hex-seasons") renderHexSeasonChart();
                    });
                    li.appendChild(btn);
                    listElHexSeason.appendChild(li);
                });
            }

            function renderAnnualChart() {
                const selectedYears = state.years.length
                    ? state.years
                    : getAnnualPresetYears(state.rows, state.annualMode).filter((y) => availableYears.has(y));

                const byYear = new Map();
                selectedYears.forEach((y) => byYear.set(y, []));
                state.rows.forEach((entry) => {
                    if (byYear.has(entry.year)) byYear.get(entry.year).push(entry);
                });

                const traces = [];
                const targetDoy = dayOfYear(TARGET_DATE);
                const targetValues = [];
                let projectionText = "";
                selectedYears.forEach((year, idx) => {
                    const entries = (byYear.get(year) || []).slice().sort((a, b) => a.date - b.date);
                    if (!entries.length) {
                        targetValues.push({ year, value: null });
                        return;
                    }
                    let cumulative = 0;
                    const points = entries.map((entry) => {
                        cumulative += entry.value;
                        return { ...entry, ytd: cumulative, isProjected: false };
                    });

                    const isLatestYear = year === state.latestYear;
                    const projectedRows = isLatestYear && state.projection ? state.projection.projectedRows : [];

                    if (isLatestYear && projectedRows && projectedRows.length) {
                        const projectedPoints = [];
                        let projectedCumulative = cumulative;
                        projectedRows.forEach((entry) => {
                            projectedCumulative += entry.value;
                            projectedPoints.push({ ...entry, ytd: projectedCumulative, isProjected: true });
                        });

                        traces.push({
                            x: points.map((p) => p.doy),
                            y: points.map((p) => p.ytd),
                            mode: "lines",
                            name: year + " (YTD total)",
                            line: { color: COLOR_PALETTE[idx] || "#999", width: 2 },
                            customdata: points.map((p) => ({
                                label: new Date(p.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
                                formatted: p.ytd.toFixed(1)
                            })),
                            hovertemplate: "%{customdata.label}<br>YTD precipitation: %{customdata.formatted} mm<extra></extra>"
                        });

                        traces.push({
                            x: [points[points.length - 1].doy, ...projectedPoints.map((p) => p.doy)],
                            y: [points[points.length - 1].ytd, ...projectedPoints.map((p) => p.ytd)],
                            mode: "lines",
                            name: year + " projection (30y day-mean)",
                            line: { color: COLOR_PALETTE[idx] || "#999", width: 2, dash: "dot" },
                            customdata: [points[points.length - 1], ...projectedPoints].map((p) => ({
                                label: new Date(p.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
                                formatted: p.ytd.toFixed(1),
                                projected: p.isProjected ? "Yes" : "No"
                            })),
                            hovertemplate: "%{customdata.label}<br>YTD precipitation: %{customdata.formatted} mm<br>Projected: %{customdata.projected}<extra></extra>"
                        });

                        const projectedEnd = projectedPoints[projectedPoints.length - 1];
                        projectionText = "<br><strong>" + year + " projected year-end total: " + projectedEnd.ytd.toFixed(1) + " mm</strong>";
                        const target = [...points, ...projectedPoints].find((p) => p.doy === targetDoy);
                        targetValues.push({ year, value: target ? target.ytd : null });
                    } else {
                        traces.push({
                            x: points.map((p) => p.doy),
                            y: points.map((p) => p.ytd),
                            mode: "lines",
                            name: year + " (YTD total)",
                            line: { color: COLOR_PALETTE[idx] || "#999", width: 2 },
                            customdata: points.map((p) => ({
                                label: new Date(p.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
                                formatted: p.ytd.toFixed(1)
                            })),
                            hovertemplate: "%{customdata.label}<br>YTD precipitation: %{customdata.formatted} mm<extra></extra>"
                        });
                        const target = points.find((p) => p.doy === targetDoy);
                        targetValues.push({ year, value: target ? target.ytd : null });
                    }

                });

                targetValues.sort((a, b) => {
                    if (a.value === null && b.value === null) return 0;
                    if (a.value === null) return 1;
                    if (b.value === null) return -1;
                    return b.value - a.value;
                });
                const targetDay = TARGET_DATE.getUTCDate();
                const targetMonth = TARGET_DATE.toLocaleString("en-GB", { month: "short" });
                summaryEl.innerHTML =
                    "<strong>" + targetDay + " " + targetMonth + " YTD precipitation (high -> low)</strong><br>" +
                    targetValues.map((item) => (
                        item.value === null ? item.year + ": n/a" : item.year + ": " + item.value.toFixed(1) + " mm"
                    )).join("<br>") + projectionText;

                const monthStarts = Array.from({ length: 12 }, (_, idx) => dayOfYear(new Date(Date.UTC(2025, idx, 1))));
                const layout = {
                    title: "Year-to-Date Cumulative Precipitation (EWP)",
                    xaxis: {
                        title: "Day of Year",
                        tickmode: "array",
                        tickvals: monthStarts,
                        ticktext: MONTH_NAMES,
                        range: [1, 366]
                    },
                    yaxis: { title: "Cumulative Precipitation (mm)" },
                    margin: { l: 70, r: 20, t: 70, b: 60 },
                    legend: { orientation: "h", x: 0, y: -0.2 },
                    shapes: buildMonthShapes(monthStarts, targetDoy)
                };
                chartEl.textContent = "";
                Plotly.newPlot(chartEl, traces, layout, { responsive: true });
            }

            function renderMonthlyChart() {
                if (state.monthlyYears === null) {
                    state.monthlyYears = getMonthlyPresetYears(state.rows, state.selectedMonth, state.monthlyMode)
                        .filter((y) => availableYears.has(y));
                    state.monthlyYears.sort((a, b) => b - a);
                }

                const yearsToShow = state.monthlyYears.length
                    ? state.monthlyYears
                    : getMonthlyPresetYears(state.rows, state.selectedMonth, state.monthlyMode).filter((y) => availableYears.has(y));

                const traces = [];
                yearsToShow.forEach((year, idx) => {
                    const entries = state.rows
                        .filter((row) => row.year === year && (new Date(row.date).getUTCMonth() + 1) === state.selectedMonth)
                        .slice()
                        .sort((a, b) => a.date - b.date);
                    const isLatestYear = year === state.latestYear;
                    const projectedMonthEntries = isLatestYear && state.projection
                        ? state.projection.projectedRows
                            .filter((row) => (new Date(row.date).getUTCMonth() + 1) === state.selectedMonth)
                            .slice()
                            .sort((a, b) => a.date - b.date)
                        : [];
                    if (!entries.length && !projectedMonthEntries.length) return;

                    let cumulative = 0;
                    const points = entries.map((entry) => {
                        cumulative += entry.value;
                        return { ...entry, monthlyCumulative: cumulative, isProjected: false };
                    });

                    if (projectedMonthEntries.length) {
                        let projectedCumulative = cumulative;
                        const projectedPoints = projectedMonthEntries.map((entry) => {
                            projectedCumulative += entry.value;
                            return { ...entry, monthlyCumulative: projectedCumulative, isProjected: true };
                        });

                        if (points.length) {
                            traces.push({
                                x: points.map((p) => new Date(p.date).getUTCDate()),
                                y: points.map((p) => p.monthlyCumulative),
                                mode: "lines",
                                name: year + " (" + MONTH_NAMES[state.selectedMonth - 1] + " total)",
                                line: { color: COLOR_PALETTE[idx] || "#999", width: 2 },
                                customdata: points.map((p) => ({
                                    label: new Date(p.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
                                    formatted: p.monthlyCumulative.toFixed(1)
                                })),
                                hovertemplate: "%{customdata.label}<br>Month cumulative: %{customdata.formatted} mm<extra></extra>"
                            });
                        }

                        const connectorX = points.length ? [new Date(points[points.length - 1].date).getUTCDate()] : [];
                        const connectorY = points.length ? [points[points.length - 1].monthlyCumulative] : [];
                        const connectorCustom = points.length ? [{
                            label: new Date(points[points.length - 1].date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
                            formatted: points[points.length - 1].monthlyCumulative.toFixed(1),
                            projected: "No"
                        }] : [];

                        traces.push({
                            x: [...connectorX, ...projectedPoints.map((p) => new Date(p.date).getUTCDate())],
                            y: [...connectorY, ...projectedPoints.map((p) => p.monthlyCumulative)],
                            mode: "lines",
                            name: year + " projection (30y day-mean)",
                            line: { color: COLOR_PALETTE[idx] || "#999", width: 2, dash: "dot" },
                            customdata: [...connectorCustom, ...projectedPoints.map((p) => ({
                                label: new Date(p.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
                                formatted: p.monthlyCumulative.toFixed(1),
                                projected: "Yes"
                            }))],
                            hovertemplate: "%{customdata.label}<br>Month cumulative: %{customdata.formatted} mm<br>Projected: %{customdata.projected}<extra></extra>"
                        });
                    } else {
                        traces.push({
                            x: points.map((p) => new Date(p.date).getUTCDate()),
                            y: points.map((p) => p.monthlyCumulative),
                            mode: "lines",
                            name: year + " (" + MONTH_NAMES[state.selectedMonth - 1] + " total)",
                            line: { color: COLOR_PALETTE[idx] || "#999", width: 2 },
                            customdata: points.map((p) => ({
                                label: new Date(p.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
                                formatted: p.monthlyCumulative.toFixed(1)
                            })),
                            hovertemplate: "%{customdata.label}<br>Month cumulative: %{customdata.formatted} mm<extra></extra>"
                        });
                    }
                });

                const maxDays = new Date(Date.UTC(2024, state.selectedMonth, 0)).getUTCDate();
                const modeLabel = state.monthlyMode === "wettest"
                    ? "Wettest 9 years"
                    : state.monthlyMode === "driest"
                        ? "Driest 9 years"
                        : state.monthlyMode === "recent"
                            ? "Most recent 10 years"
                            : "Mixed (5 wettest + 4 driest)";
                summaryEl.innerHTML = "<strong>" + modeLabel + " for " + MONTH_NAMES[state.selectedMonth - 1] + "</strong>";

                const layout = {
                    title: MONTH_NAMES[state.selectedMonth - 1] + " Cumulative Precipitation (EWP)",
                    xaxis: { title: "Day of Month", range: [1, maxDays] },
                    yaxis: { title: "Cumulative Precipitation (mm)" },
                    margin: { l: 70, r: 20, t: 70, b: 60 },
                    legend: { orientation: "h", x: 0, y: -0.2 }
                };
                chartEl.textContent = "";
                Plotly.newPlot(chartEl, traces, layout, { responsive: true });
                renderMonthlyYearList();
            }

            function renderSeasonChart() {
                const season = state.selectedSeason;
                const seasonInfo = SEASONS[season];
                const hasSeasonData = (year) => entriesForSeason(year, season, state.rows).length ||
                    (year === state.latestYear && state.projection && entriesForSeason(year, season, state.projection.projectedRows).length);
                if (state.seasonYears === null) {
                    state.seasonYears = getSeasonPresetYears(state.rows, season, state.seasonMode)
                        .filter((y) => hasSeasonData(y));
                    state.seasonYears.sort((a, b) => b - a);
                }

                const fallbackYears = getSeasonPresetYears(state.rows, season, state.seasonMode)
                    .filter((y) => hasSeasonData(y));
                const yearsToShow = state.seasonYears.length ? state.seasonYears : fallbackYears;
                const traces = [];

                yearsToShow.forEach((year, idx) => {
                    const entries = entriesForSeason(year, season, state.rows);
                    const projectedSeasonEntries = year === state.latestYear && state.projection
                        ? entriesForSeason(year, season, state.projection.projectedRows)
                        : [];
                    if (!entries.length && !projectedSeasonEntries.length) return;

                    let cumulative = 0;
                    const points = entries.map((entry) => {
                        cumulative += entry.value;
                        return { ...entry, seasonCumulative: cumulative, isProjected: false };
                    });

                    if (points.length) {
                        traces.push({
                            x: points.map((p) => seasonDayIndex(new Date(p.date), season)),
                            y: points.map((p) => p.seasonCumulative),
                            mode: "lines",
                            name: year + " (" + seasonInfo.label + " total)",
                            line: { color: COLOR_PALETTE[idx] || "#999", width: 2 },
                            customdata: points.map((p) => ({
                                label: new Date(p.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
                                formatted: p.seasonCumulative.toFixed(1)
                            })),
                            hovertemplate: "%{customdata.label}<br>Season cumulative: %{customdata.formatted} mm<extra></extra>"
                        });
                    }

                    if (projectedSeasonEntries.length) {
                        let projectedCumulative = cumulative;
                        const projectedPoints = projectedSeasonEntries.map((entry) => {
                            projectedCumulative += entry.value;
                            return { ...entry, seasonCumulative: projectedCumulative, isProjected: true };
                        });
                        const connectorX = points.length ? [seasonDayIndex(new Date(points[points.length - 1].date), season)] : [];
                        const connectorY = points.length ? [points[points.length - 1].seasonCumulative] : [];
                        const connectorCustom = points.length ? [{
                            label: new Date(points[points.length - 1].date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
                            formatted: points[points.length - 1].seasonCumulative.toFixed(1),
                            projected: "No"
                        }] : [];
                        traces.push({
                            x: [...connectorX, ...projectedPoints.map((p) => seasonDayIndex(new Date(p.date), season))],
                            y: [...connectorY, ...projectedPoints.map((p) => p.seasonCumulative)],
                            mode: "lines",
                            name: year + " projection (30y day-mean)",
                            line: { color: COLOR_PALETTE[idx] || "#999", width: 2, dash: "dot" },
                            customdata: [...connectorCustom, ...projectedPoints.map((p) => ({
                                label: new Date(p.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
                                formatted: p.seasonCumulative.toFixed(1),
                                projected: "Yes"
                            }))],
                            hovertemplate: "%{customdata.label}<br>Season cumulative: %{customdata.formatted} mm<br>Projected: %{customdata.projected}<extra></extra>"
                        });
                    }
                });

                const modeLabel = state.seasonMode === "wettest"
                    ? "Wettest 9 years"
                    : state.seasonMode === "driest"
                        ? "Driest 9 years"
                        : state.seasonMode === "recent"
                            ? "Most recent 10 years"
                            : "Mixed (5 wettest + 4 driest)";
                summaryEl.innerHTML = "<strong>" + modeLabel + " for " + seasonInfo.label + "</strong>";

                const layoutYear = state.latestYear || new Date().getUTCFullYear();
                const layout = {
                    title: seasonInfo.label + " Cumulative Precipitation (EWP)",
                    xaxis: {
                        title: "Day of Season",
                        tickmode: "array",
                        tickvals: seasonMonthStarts(layoutYear, season),
                        ticktext: seasonInfo.ticktext,
                        range: [1, maxSeasonDay(layoutYear, season)]
                    },
                    yaxis: { title: "Cumulative Precipitation (mm)" },
                    margin: { l: 70, r: 20, t: 70, b: 60 },
                    legend: { orientation: "h", x: 0, y: -0.2 }
                };
                chartEl.textContent = "";
                Plotly.newPlot(chartEl, traces, layout, { responsive: true });
                renderSeasonYearList();
            }

            function renderHexSeasonChart() {
                const season = state.selectedHexSeason;
                const seasonInfo = HEX_SEASONS[season];
                const hasHexSeasonData = (year) => entriesForHexSeason(year, season, state.rows).length ||
                    (year === state.latestYear && state.projection && entriesForHexSeason(year, season, state.projection.projectedRows).length);
                if (state.hexSeasonYears === null) {
                    state.hexSeasonYears = getHexSeasonPresetYears(state.rows, season, state.hexSeasonMode)
                        .filter((y) => hasHexSeasonData(y));
                    state.hexSeasonYears.sort((a, b) => b - a);
                }

                const fallbackYears = getHexSeasonPresetYears(state.rows, season, state.hexSeasonMode)
                    .filter((y) => hasHexSeasonData(y));
                const yearsToShow = state.hexSeasonYears.length ? state.hexSeasonYears : fallbackYears;
                const traces = [];

                yearsToShow.forEach((year, idx) => {
                    const entries = entriesForHexSeason(year, season, state.rows);
                    const projectedHexEntries = year === state.latestYear && state.projection
                        ? entriesForHexSeason(year, season, state.projection.projectedRows)
                        : [];
                    if (!entries.length && !projectedHexEntries.length) return;

                    let cumulative = 0;
                    const points = entries.map((entry) => {
                        cumulative += entry.value;
                        return { ...entry, hexSeasonCumulative: cumulative, isProjected: false };
                    });

                    if (points.length) {
                        traces.push({
                            x: points.map((p) => hexSeasonDayIndex(new Date(p.date), season)),
                            y: points.map((p) => p.hexSeasonCumulative),
                            mode: "lines",
                            name: year + " (" + seasonInfo.label + " total)",
                            line: { color: COLOR_PALETTE[idx] || "#999", width: 2 },
                            customdata: points.map((p) => ({
                                label: new Date(p.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
                                formatted: p.hexSeasonCumulative.toFixed(1)
                            })),
                            hovertemplate: "%{customdata.label}<br>Hex-season cumulative: %{customdata.formatted} mm<extra></extra>"
                        });
                    }

                    if (projectedHexEntries.length) {
                        let projectedCumulative = cumulative;
                        const projectedPoints = projectedHexEntries.map((entry) => {
                            projectedCumulative += entry.value;
                            return { ...entry, hexSeasonCumulative: projectedCumulative, isProjected: true };
                        });
                        const connectorX = points.length ? [hexSeasonDayIndex(new Date(points[points.length - 1].date), season)] : [];
                        const connectorY = points.length ? [points[points.length - 1].hexSeasonCumulative] : [];
                        const connectorCustom = points.length ? [{
                            label: new Date(points[points.length - 1].date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
                            formatted: points[points.length - 1].hexSeasonCumulative.toFixed(1),
                            projected: "No"
                        }] : [];
                        traces.push({
                            x: [...connectorX, ...projectedPoints.map((p) => hexSeasonDayIndex(new Date(p.date), season))],
                            y: [...connectorY, ...projectedPoints.map((p) => p.hexSeasonCumulative)],
                            mode: "lines",
                            name: year + " projection (30y day-mean)",
                            line: { color: COLOR_PALETTE[idx] || "#999", width: 2, dash: "dot" },
                            customdata: [...connectorCustom, ...projectedPoints.map((p) => ({
                                label: new Date(p.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
                                formatted: p.hexSeasonCumulative.toFixed(1),
                                projected: "Yes"
                            }))],
                            hovertemplate: "%{customdata.label}<br>Hex-season cumulative: %{customdata.formatted} mm<br>Projected: %{customdata.projected}<extra></extra>"
                        });
                    }
                });

                const modeLabel = state.hexSeasonMode === "wettest"
                    ? "Wettest 9 years"
                    : state.hexSeasonMode === "driest"
                        ? "Driest 9 years"
                        : state.hexSeasonMode === "recent"
                            ? "Most recent 10 years"
                            : "Mixed (5 wettest + 4 driest)";
                summaryEl.innerHTML = "<strong>" + modeLabel + " for " + seasonInfo.label + "</strong>";

                const layoutYear = state.latestYear || new Date().getUTCFullYear();
                const layout = {
                    title: seasonInfo.label + " Cumulative Precipitation (EWP)",
                    xaxis: {
                        title: "Day of Hex-Season",
                        tickmode: "array",
                        tickvals: hexSeasonMonthStarts(layoutYear, season),
                        ticktext: seasonInfo.ticktext,
                        range: [1, maxHexSeasonDay(layoutYear, season)]
                    },
                    yaxis: { title: "Cumulative Precipitation (mm)" },
                    margin: { l: 70, r: 20, t: 70, b: 60 },
                    legend: { orientation: "h", x: 0, y: -0.2 }
                };
                chartEl.textContent = "";
                Plotly.newPlot(chartEl, traces, layout, { responsive: true });
                renderHexSeasonYearList();
            }

            document.querySelectorAll(".tab").forEach((tab) => {
                tab.addEventListener("click", () => {
                    const tabName = tab.dataset.tab;
                    state.currentView = tabName;
                    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
                    tab.classList.add("active");
                    document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
                    document.getElementById(tabName + "-controls").classList.add("active");
                    if (tabName === "annual") renderAnnualChart();
                    if (tabName === "months") renderMonthlyChart();
                    if (tabName === "seasons") renderSeasonChart();
                    if (tabName === "hex-seasons") renderHexSeasonChart();
                });
            });

            document.querySelectorAll(".mode-button-annual").forEach((btn) => {
                btn.addEventListener("click", () => {
                    state.annualMode = btn.dataset.mode;
                    state.years = getAnnualPresetYears(state.rows, state.annualMode).filter((y) => availableYears.has(y));
                    state.years.sort((a, b) => b - a);
                    updateModeButtons(".mode-button-annual", state.annualMode);
                    renderYearList();
                    if (state.currentView === "annual") renderAnnualChart();
                });
            });

            document.querySelectorAll(".mode-button-monthly").forEach((btn) => {
                btn.addEventListener("click", () => {
                    state.monthlyMode = btn.dataset.mode;
                    state.monthlyYears = null;
                    updateModeButtons(".mode-button-monthly", state.monthlyMode);
                    if (state.currentView === "months") renderMonthlyChart();
                });
            });

            document.querySelectorAll(".mode-button-season").forEach((btn) => {
                btn.addEventListener("click", () => {
                    state.seasonMode = btn.dataset.mode;
                    state.seasonYears = null;
                    updateModeButtons(".mode-button-season", state.seasonMode);
                    if (state.currentView === "seasons") renderSeasonChart();
                });
            });

            document.querySelectorAll(".mode-button-hex-season").forEach((btn) => {
                btn.addEventListener("click", () => {
                    state.hexSeasonMode = btn.dataset.mode;
                    state.hexSeasonYears = null;
                    updateModeButtons(".mode-button-hex-season", state.hexSeasonMode);
                    if (state.currentView === "hex-seasons") renderHexSeasonChart();
                });
            });

            monthSelect.addEventListener("change", () => {
                state.selectedMonth = parseInt(monthSelect.value, 10);
                state.monthlyYears = null;
                if (state.currentView === "months") renderMonthlyChart();
            });

            seasonSelect.addEventListener("change", () => {
                state.selectedSeason = seasonSelect.value;
                state.seasonYears = null;
                if (state.currentView === "seasons") renderSeasonChart();
            });

            hexSeasonSelect.addEventListener("change", () => {
                state.selectedHexSeason = hexSeasonSelect.value;
                state.hexSeasonYears = null;
                if (state.currentView === "hex-seasons") renderHexSeasonChart();
            });

            form.addEventListener("submit", (event) => {
                event.preventDefault();
                errorEl.textContent = "";
                const year = parseInt(input.value.trim(), 10);
                if (!Number.isInteger(year)) {
                    errorEl.textContent = "Enter a valid year.";
                    return;
                }
                if (!availableYears.has(year)) {
                    errorEl.textContent = "Year not found in dataset.";
                    return;
                }
                if (state.years.includes(year)) {
                    errorEl.textContent = "Year already added.";
                    return;
                }
                if (state.years.length >= MAX_YEARS) {
                    errorEl.textContent = "Maximum of 10 years.";
                    return;
                }
                state.years.push(year);
                state.years.sort((a, b) => b - a);
                renderYearList();
                if (state.currentView === "annual") renderAnnualChart();
                form.reset();
            });

            formMonthly.addEventListener("submit", (event) => {
                event.preventDefault();
                errorElMonthly.textContent = "";
                const year = parseInt(inputMonthly.value.trim(), 10);
                if (!Number.isInteger(year)) {
                    errorElMonthly.textContent = "Enter a valid year.";
                    return;
                }
                if (!availableYears.has(year)) {
                    errorElMonthly.textContent = "Year not found in dataset.";
                    return;
                }
                if (!state.monthlyYears) state.monthlyYears = [];
                if (state.monthlyYears.includes(year)) {
                    errorElMonthly.textContent = "Year already added.";
                    return;
                }
                if (state.monthlyYears.length >= MAX_YEARS) {
                    errorElMonthly.textContent = "Maximum of 10 years.";
                    return;
                }
                state.monthlyYears.push(year);
                state.monthlyYears.sort((a, b) => b - a);
                renderMonthlyYearList();
                if (state.currentView === "months") renderMonthlyChart();
                formMonthly.reset();
            });

            formSeason.addEventListener("submit", (event) => {
                event.preventDefault();
                errorElSeason.textContent = "";
                const year = parseInt(inputSeason.value.trim(), 10);
                if (!Number.isInteger(year)) {
                    errorElSeason.textContent = "Enter a valid year.";
                    return;
                }
                const hasSeasonData = entriesForSeason(year, state.selectedSeason, state.rows).length ||
                    (year === state.latestYear && state.projection && entriesForSeason(year, state.selectedSeason, state.projection.projectedRows).length);
                if (!hasSeasonData) {
                    errorElSeason.textContent = "Year not found in season.";
                    return;
                }
                if (!state.seasonYears) state.seasonYears = [];
                if (state.seasonYears.includes(year)) {
                    errorElSeason.textContent = "Year already added.";
                    return;
                }
                if (state.seasonYears.length >= MAX_YEARS) {
                    errorElSeason.textContent = "Maximum of 10 years.";
                    return;
                }
                state.seasonYears.push(year);
                state.seasonYears.sort((a, b) => b - a);
                renderSeasonYearList();
                if (state.currentView === "seasons") renderSeasonChart();
                formSeason.reset();
            });

            formHexSeason.addEventListener("submit", (event) => {
                event.preventDefault();
                errorElHexSeason.textContent = "";
                const year = parseInt(inputHexSeason.value.trim(), 10);
                if (!Number.isInteger(year)) {
                    errorElHexSeason.textContent = "Enter a valid year.";
                    return;
                }
                const hasHexSeasonData = entriesForHexSeason(year, state.selectedHexSeason, state.rows).length ||
                    (year === state.latestYear && state.projection && entriesForHexSeason(year, state.selectedHexSeason, state.projection.projectedRows).length);
                if (!hasHexSeasonData) {
                    errorElHexSeason.textContent = "Year not found in hex-season.";
                    return;
                }
                if (!state.hexSeasonYears) state.hexSeasonYears = [];
                if (state.hexSeasonYears.includes(year)) {
                    errorElHexSeason.textContent = "Year already added.";
                    return;
                }
                if (state.hexSeasonYears.length >= MAX_YEARS) {
                    errorElHexSeason.textContent = "Maximum of 10 years.";
                    return;
                }
                state.hexSeasonYears.push(year);
                state.hexSeasonYears.sort((a, b) => b - a);
                renderHexSeasonYearList();
                if (state.currentView === "hex-seasons") renderHexSeasonChart();
                formHexSeason.reset();
            });

            updateModeButtons(".mode-button-annual", state.annualMode);
            updateModeButtons(".mode-button-monthly", state.monthlyMode);
            updateModeButtons(".mode-button-season", state.seasonMode);
            updateModeButtons(".mode-button-hex-season", state.hexSeasonMode);
            renderYearList();
            renderMonthlyYearList();
            renderSeasonYearList();
            renderHexSeasonYearList();
            renderAnnualChart();
        }).catch((error) => {
            const chartEl = document.getElementById("chart");
            if (chartEl) {
                chartEl.innerHTML = "<div style='padding:16px;color:#b00020;'>Failed to load EWP data.<br>" +
                    (error.message || error) + "</div>";
            }
        });
    })();
