(function () {
        const CSV_PATH = "data/MeanTempCET.csv";
        const FORECAST_2026_PATH = "data/forecast_2026.csv";
        const DEFAULT_YEARS = [2025, 2024, 2023, 2022, 2020, 2018, 2026, 2014, 2011, 2006];
        const COLOR_PALETTE = [
            "#ff4136", "#ff851b", "#ffd700", "#39ff14", "#006400",
            "#00ced1", "#1f77ff", "#4b0082", "#8000ff", "#ff69b4"
        ];
        const MAX_YEARS = 10;
        let TARGET_DATE = null;

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
                const parts = trimmed.split("/").map((part) => parseInt(part, 10));
                if (parts.length === 3 && parts.every((n) => Number.isInteger(n))) {
                    const [day, month, year] = parts;
                    const date = new Date(Date.UTC(year, month - 1, day));
                    return Number.isNaN(date.getTime()) ? null : date;
                }
            }
            return null;
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
                if (!date || Number.isNaN(value) || Number.isNaN(date.getTime())) {
                    return null;
                }
                return {
                    date,
                    value,
                    year: date.getUTCFullYear(),
                    month: date.getUTCMonth() + 1,
                    doy: dayOfYear(date)
                };
            }).filter(Boolean);
        }

        function latestDateForYear(rows, year) {
            const entries = rows
                .filter((row) => row.year === year)
                .slice()
                .sort((a, b) => a.date - b.date);
            return entries.length ? new Date(entries[entries.length - 1].date) : null;
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

        function countDaysAboveInYear(rows, year, threshold) {
            return rows.filter((r) => r.year === year && r.value >= threshold).length;
        }

        function countDaysAboveInMonth(rows, year, month, threshold) {
            return rows.filter(
                (r) => r.year === year && r.month === month && r.value >= threshold
            ).length;
        }

        function getYearsAnnualPreset(mode, rows, threshold, availableYears, currentYear, maxYears) {
            const stats = [];
            availableYears.forEach((y) => {
                if (y === 2026) return;
                stats.push({ year: y, count: countDaysAboveInYear(rows, y, threshold) });
            });
            if (mode === "last9") {
                const LAST9 = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017];
                return LAST9.filter((y) => availableYears.has(y)).slice(0, maxYears);
            }
            if (mode === "most") {
                stats.sort((a, b) => b.count - a.count || a.year - b.year);
            } else if (mode === "fewest") {
                stats.sort((a, b) => a.count - b.count || a.year - b.year);
            } else if (mode === "mixed") {
                stats.sort((a, b) => b.count - a.count || a.year - b.year);
                const top = stats.filter((s) => s.year !== currentYear).slice(0, 5);
                const rest = stats.filter((s) => s.year !== currentYear).slice();
                rest.sort((a, b) => a.count - b.count || a.year - b.year);
                const bottom = rest.slice(0, 4);
                const set = new Set([...top.map((t) => t.year), ...bottom.map((b) => b.year), currentYear]);
                return Array.from(set).slice(0, maxYears);
            }
            const filtered = stats.filter((s) => s.year !== currentYear).slice(0, 9);
            return [...filtered.map((s) => s.year), currentYear].filter((y, i, a) => a.indexOf(y) === i).slice(0, maxYears);
        }

        function getYearsMonthlyPreset(month, mode, rows, threshold, availableYears, currentYear, maxYears) {
            const stats = [];
            availableYears.forEach((y) => {
                stats.push({ year: y, count: countDaysAboveInMonth(rows, y, month, threshold) });
            });
            if (mode === "most") {
                stats.sort((a, b) => b.count - a.count || a.year - b.year);
            } else if (mode === "fewest") {
                stats.sort((a, b) => a.count - b.count || a.year - b.year);
            } else {
                stats.sort((a, b) => b.count - a.count || a.year - b.year);
                const top = stats.filter((s) => s.year !== currentYear).slice(0, 5);
                const rest = stats.filter((s) => s.year !== currentYear).slice();
                rest.sort((a, b) => a.count - b.count || a.year - b.year);
                const bottom = rest.slice(0, 4);
                const set = new Set([...top.map((t) => t.year), ...bottom.map((b) => b.year), currentYear]);
                return Array.from(set).slice(0, maxYears);
            }
            const filtered = stats.filter((s) => s.year !== currentYear).slice(0, 9);
            return [...filtered.map((s) => s.year), currentYear].filter((y, i, a) => a.indexOf(y) === i).slice(0, maxYears);
        }

        function cumulativePointsFromEntries(entries, threshold) {
            let cum = 0;
            return entries.map((entry) => {
                if (entry.value >= threshold) cum += 1;
                return { ...entry, cum };
            });
        }

        Promise.all([
            loadCsvRows(CSV_PATH),
            loadCsvRows(FORECAST_2026_PATH).catch(() => [])
        ]).then(([rows, forecast2026Rows]) => {
            const observedRows = rows.slice();
            const currentYear = new Date().getUTCFullYear();
            TARGET_DATE = latestDateForYear(observedRows, 2026) ||
                latestDateForYear(observedRows, currentYear) ||
                (observedRows.length ? new Date(observedRows[observedRows.length - 1].date) : new Date());
            const availableYears = new Set(rows.map((r) => r.year));
            if (forecast2026Rows.length > 0) {
                availableYears.add(2026);
                rows = rows.concat(forecast2026Rows);
            }

            const state = {
                rows,
                forecast2026: forecast2026Rows,
                threshold: 15,
                years: DEFAULT_YEARS.slice(0, MAX_YEARS).filter((y) => availableYears.has(y)),
                monthlyYears: null,
                currentView: "annual",
                selectedMonth: 12,
                yearMode: "most",
                annualYearMode: "most",
                annualYearsCustom: false
            };
            state.years.sort((a, b) => b - a);

            const chartEl = document.getElementById("chart");
            const summaryEl = document.getElementById("threshold-summary");
            const forecastSummaryEl = document.getElementById("forecast-summary");
            const listEl = document.getElementById("year-list");
            const form = document.getElementById("year-form");
            const input = document.getElementById("year-input");
            const errorEl = document.getElementById("year-error");
            const monthSelect = document.getElementById("month-select");
            const listElMonthly = document.getElementById("year-list-monthly");
            const formMonthly = document.getElementById("year-form-monthly");
            const inputMonthly = document.getElementById("year-input-monthly");
            const errorElMonthly = document.getElementById("year-error-monthly");
            const thresholdInput = document.getElementById("threshold-input");

            function getThreshold() {
                const v = parseFloat(thresholdInput.value, 10);
                return Number.isFinite(v) ? v : state.threshold;
            }

            function applyAnnualPreset() {
                const t = getThreshold();
                state.years = getYearsAnnualPreset(
                    state.annualYearMode,
                    state.rows,
                    t,
                    availableYears,
                    currentYear,
                    MAX_YEARS
                );
            }

            thresholdInput.addEventListener("input", () => {
                state.threshold = getThreshold();
                if (!state.annualYearsCustom) {
                    applyAnnualPreset();
                    renderYearList();
                }
                if (state.currentView === "annual") renderChart();
                else {
                    state.monthlyYears = null;
                    renderMonthlyChart();
                }
            });

            document.querySelectorAll(".tab").forEach((tab) => {
                tab.addEventListener("click", () => {
                    const tabName = tab.dataset.tab;
                    state.currentView = tabName;
                    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
                    tab.classList.add("active");
                    document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
                    document.getElementById(`${tabName}-controls`).classList.add("active");
                    if (tabName === "annual") {
                        if (!state.annualYearsCustom) {
                            applyAnnualPreset();
                            renderYearList();
                        }
                        renderChart();
                    } else {
                        renderMonthlyChart();
                    }
                });
            });

            monthSelect.addEventListener("change", () => {
                state.selectedMonth = parseInt(monthSelect.value, 10);
                state.monthlyYears = null;
                if (state.currentView === "months") renderMonthlyChart();
            });

            function updateModeButtons() {
                document.querySelectorAll(".mode-button").forEach((btn) => {
                    const on = btn.dataset.mode === state.yearMode;
                    btn.style.background = on ? "#4CAF50" : "#f0f0f0";
                    btn.style.color = on ? "#fff" : "#000";
                    btn.style.borderColor = on ? "#4CAF50" : "#ccc";
                });
            }

            document.querySelectorAll(".mode-button").forEach((btn) => {
                btn.addEventListener("click", () => {
                    state.yearMode = btn.dataset.mode;
                    updateModeButtons();
                    state.monthlyYears = null;
                    if (state.currentView === "months") renderMonthlyChart();
                });
            });
            updateModeButtons();

            function updateAnnualModeButtons() {
                document.querySelectorAll(".mode-button-annual").forEach((btn) => {
                    const on = btn.dataset.mode === state.annualYearMode;
                    btn.style.background = on ? "#4CAF50" : "#f0f0f0";
                    btn.style.color = on ? "#fff" : "#000";
                    btn.style.borderColor = on ? "#4CAF50" : "#ccc";
                });
            }

            document.querySelectorAll(".mode-button-annual").forEach((btn) => {
                btn.addEventListener("click", () => {
                    state.annualYearMode = btn.dataset.mode;
                    state.annualYearsCustom = false;
                    applyAnnualPreset();
                    updateAnnualModeButtons();
                    renderYearList();
                    if (state.currentView === "annual") renderChart();
                });
            });
            updateAnnualModeButtons();

            function entriesForYearFull2026(year, allRows, forecastRows) {
                if (year !== 2026) return allRows.filter((r) => r.year === year).sort((a, b) => a.date - b.date);
                const forecastDates = new Set((forecastRows || []).map((e) => e.date.getTime()));
                const actual = allRows.filter((r) => r.year === 2026 && !forecastDates.has(r.date.getTime()));
                const dataMap = new Map();
                actual.forEach((e) => dataMap.set(e.date.getTime(), e));
                (forecastRows || []).forEach((e) => {
                    if (!dataMap.has(e.date.getTime())) dataMap.set(e.date.getTime(), e);
                });
                return Array.from(dataMap.values()).sort((a, b) => a.date - b.date);
            }

            function renderChart() {
                const threshold = getThreshold();
                let YEARS = state.years.length
                    ? state.years
                    : DEFAULT_YEARS.slice(0, MAX_YEARS).filter((y) => availableYears.has(y));
                const targetDoy = dayOfYear(TARGET_DATE);
                const traces = [];
                const endCounts = [];

                YEARS.forEach((year, idx) => {
                    const color = COLOR_PALETTE[idx] || "#999";
                    const allEntries = entriesForYearFull2026(year, state.rows, state.forecast2026);

                    if (year === 2026 && state.forecast2026 && state.forecast2026.length) {
                        const confirmed = allEntries.filter((e) => e.date <= TARGET_DATE);
                        const forecastOnly = allEntries.filter((e) => e.date > TARGET_DATE);
                        const confPts = cumulativePointsFromEntries(confirmed, threshold);
                        if (confPts.length) {
                            traces.push({
                                x: confPts.map((p) => p.doy),
                                y: confPts.map((p) => p.cum),
                                mode: "lines",
                                name: `${year} (cumulative)`,
                                line: { color, width: 2 },
                                customdata: confPts.map((p) => ({
                                    label: p.date.toLocaleDateString("en-GB", {
                                        day: "2-digit",
                                        month: "short",
                                        year: "numeric"
                                    }),
                                    cum: p.cum
                                })),
                                hovertemplate: "%{customdata.label}<br>Days ≥ " + threshold + "°C: %{customdata.cum}<extra></extra>"
                            });
                        }
                        if (forecastOnly.length && confPts.length) {
                            let acc = confPts[confPts.length - 1].cum;
                            const fcLine = forecastOnly.map((e) => {
                                if (e.value >= threshold) acc += 1;
                                return { ...e, cum: acc };
                            });
                            traces.push({
                                x: fcLine.map((p) => p.doy),
                                y: fcLine.map((p) => p.cum),
                                mode: "lines",
                                name: `${year} forecast (cumulative)`,
                                line: { color, width: 2, dash: "dot" },
                                customdata: fcLine.map((p) => ({
                                    label: p.date.toLocaleDateString("en-GB", {
                                        day: "2-digit",
                                        month: "short",
                                        year: "numeric"
                                    }),
                                    cum: p.cum
                                })),
                                hovertemplate: "%{customdata.label}<br>Days ≥ " + threshold + "°C: %{customdata.cum}<extra></extra>"
                            });
                        }
                        const last = allEntries.length ? cumulativePointsFromEntries(allEntries, threshold).pop() : null;
                        endCounts.push({ year, cum: last ? last.cum : null });
                        return;
                    }

                    const entries = allEntries;
                    if (!entries.length) {
                        endCounts.push({ year, cum: null });
                        return;
                    }
                    const pts = cumulativePointsFromEntries(entries, threshold);
                    endCounts.push({ year, cum: pts.length ? pts[pts.length - 1].cum : 0 });
                    traces.push({
                        x: pts.map((p) => p.doy),
                        y: pts.map((p) => p.cum),
                        mode: "lines",
                        name: `${year} (cumulative)`,
                        line: { color, width: 2 },
                        customdata: pts.map((p) => ({
                            label: p.date.toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric"
                            }),
                            cum: p.cum
                        })),
                        hovertemplate: "%{customdata.label}<br>Days ≥ " + threshold + "°C: %{customdata.cum}<extra></extra>"
                    });
                });

                endCounts.sort((a, b) => {
                    if (a.cum === null && b.cum === null) return 0;
                    if (a.cum === null) return 1;
                    if (b.cum === null) return -1;
                    return b.cum - a.cum;
                });
                const summaryLines = endCounts.map((x) =>
                    x.cum === null ? `${x.year}: n/a` : `${x.year}: ${x.cum} days`
                );
                const td = TARGET_DATE.getUTCDate();
                const tm = TARGET_DATE.toLocaleString("en-GB", { month: "short" });
                summaryEl.innerHTML =
                    `<strong>Year-end cumulative count (or last available day) — high → low</strong><br>` +
                    summaryLines.join("<br>") +
                    `<br><small>Green vertical line: ${td} ${tm} (day of year ${targetDoy}).</small>`;

                const pt = endCounts.find((e) => e.year === 2026);
                forecastSummaryEl.innerHTML =
                    pt && pt.cum !== null && state.forecast2026.length
                        ? `<strong>2026 includes forecast after ${td} ${tm} where applicable (dotted).</strong>`
                        : "";

                const monthStarts = Array.from({ length: 12 }, (_, i) =>
                    dayOfYear(new Date(Date.UTC(2025, i, 1)))
                );
                const layout = {
                    title: `Cumulative days with mean ≥ ${threshold}°C (by day of year)`,
                    xaxis: {
                        title: "Day of year",
                        tickmode: "array",
                        tickvals: monthStarts,
                        ticktext: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
                        range: [1, 366]
                    },
                    yaxis: {
                        title: "Cumulative days ≥ threshold",
                        rangemode: "tozero"
                    },
                    margin: { l: 60, r: 20, t: 70, b: 60 },
                    legend: { orientation: "h", x: 0, y: -0.2 },
                    shapes: buildMonthShapes(monthStarts, targetDoy)
                };

                chartEl.textContent = "";
                Plotly.newPlot(chartEl, traces, layout, { responsive: true });
            }

            function renderMonthlyChart() {
                const threshold = getThreshold();
                const month = state.selectedMonth;
                const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                const monthName = monthNames[month - 1];

                let defaultYears = getYearsMonthlyPreset(
                    month,
                    state.yearMode,
                    state.rows,
                    threshold,
                    availableYears,
                    currentYear,
                    MAX_YEARS
                );
                if (state.monthlyYears === null) {
                    state.monthlyYears = [...defaultYears];
                }
                const YEARS = state.monthlyYears.length ? state.monthlyYears : defaultYears;
                const maxDom = Math.max(
                    ...YEARS.map((y) => new Date(Date.UTC(y, month, 0)).getUTCDate())
                );

                const traces = [];
                const endCounts = [];

                YEARS.forEach((year, idx) => {
                    const color = COLOR_PALETTE[idx] || "#999";
                    let entries = entriesForYearFull2026(year, state.rows, state.forecast2026).filter(
                        (r) => r.month === month
                    );
                    if (!entries.length) {
                        endCounts.push({ year, cum: null });
                        return;
                    }

                    if (year === 2026 && state.forecast2026.length) {
                        const confirmed = entries.filter((e) => e.date <= TARGET_DATE);
                        const forecastOnly = entries.filter((e) => e.date > TARGET_DATE);
                        const confPts = cumulativePointsFromEntries(confirmed, threshold);
                        if (confPts.length) {
                            traces.push({
                                x: confPts.map((p) => p.date.getUTCDate()),
                                y: confPts.map((p) => p.cum),
                                mode: "lines",
                                name: `${year} (${monthName})`,
                                line: { color, width: 2 },
                                customdata: confPts.map((p) => ({
                                    label: p.date.toLocaleDateString("en-GB", {
                                        day: "2-digit",
                                        month: "short",
                                        year: "numeric"
                                    }),
                                    cum: p.cum
                                })),
                                hovertemplate: "%{customdata.label}<br>Days ≥ " + threshold + "°C: %{customdata.cum}<extra></extra>"
                            });
                        }
                        if (forecastOnly.length && confPts.length) {
                            let acc = confPts[confPts.length - 1].cum;
                            const fcLine = forecastOnly.map((e) => {
                                if (e.value >= threshold) acc += 1;
                                return { ...e, cum: acc };
                            });
                            traces.push({
                                x: fcLine.map((p) => p.date.getUTCDate()),
                                y: fcLine.map((p) => p.cum),
                                mode: "lines",
                                name: `${year} forecast (${monthName})`,
                                line: { color, width: 2, dash: "dot" },
                                customdata: fcLine.map((p) => ({
                                    label: p.date.toLocaleDateString("en-GB", {
                                        day: "2-digit",
                                        month: "short",
                                        year: "numeric"
                                    }),
                                    cum: p.cum
                                })),
                                hovertemplate: "%{customdata.label}<br>Days ≥ " + threshold + "°C: %{customdata.cum}<extra></extra>"
                            });
                        }
                        const full = cumulativePointsFromEntries(entries, threshold);
                        endCounts.push({ year, cum: full.length ? full[full.length - 1].cum : null });
                        return;
                    }

                    const pts = cumulativePointsFromEntries(entries, threshold);
                    endCounts.push({ year, cum: pts[pts.length - 1].cum });
                    traces.push({
                        x: pts.map((p) => p.date.getUTCDate()),
                        y: pts.map((p) => p.cum),
                        mode: "lines",
                        name: `${year} (${monthName})`,
                        line: { color, width: 2 },
                        customdata: pts.map((p) => ({
                            label: p.date.toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric"
                            }),
                            cum: p.cum
                        })),
                        hovertemplate: "%{customdata.label}<br>Days ≥ " + threshold + "°C: %{customdata.cum}<extra></extra>"
                    });
                });

                endCounts.sort((a, b) => {
                    if (a.cum === null && b.cum === null) return 0;
                    if (a.cum === null) return 1;
                    if (b.cum === null) return -1;
                    return b.cum - a.cum;
                });
                const modeLabel =
                    state.yearMode === "most"
                        ? "Most days ≥ threshold"
                        : state.yearMode === "fewest"
                          ? "Fewest days ≥ threshold"
                          : "Mixed (5 most + 4 fewest)";
                summaryEl.innerHTML =
                    `<strong>${modeLabel} for ${monthName} (full month cumulative) — high → low</strong><br>` +
                    endCounts.map((x) => (x.cum === null ? `${x.year}: n/a` : `${x.year}: ${x.cum} days`)).join("<br>");
                forecastSummaryEl.innerHTML = "";

                const shapes = [];
                if (month === TARGET_DATE.getUTCMonth() + 1) {
                    const dom = TARGET_DATE.getUTCDate();
                    shapes.push({
                        type: "line",
                        x0: dom,
                        x1: dom,
                        y0: 0,
                        y1: 1,
                        xref: "x",
                        yref: "paper",
                        line: { color: "green", width: 2 }
                    });
                }

                const layout = {
                    title: `${monthName}: cumulative days with mean ≥ ${threshold}°C (by day of month)`,
                    xaxis: { title: "Day of month", range: [1, maxDom] },
                    yaxis: { title: "Cumulative days ≥ threshold", rangemode: "tozero" },
                    margin: { l: 60, r: 20, t: 70, b: 60 },
                    legend: { orientation: "h", x: 0, y: -0.2 },
                    shapes
                };

                chartEl.textContent = "";
                Plotly.newPlot(chartEl, traces, layout, { responsive: true });
                renderMonthlyYearList();
            }

            function renderYearList() {
                listEl.innerHTML = "";
                state.years.forEach((year, idx) => {
                    const li = document.createElement("li");
                    const color = COLOR_PALETTE[idx] || "#666";
                    li.style.background = color;
                    li.style.border = `1px solid ${color}`;
                    li.textContent = String(year);
                    const btn = document.createElement("button");
                    btn.type = "button";
                    btn.textContent = "×";
                    btn.addEventListener("click", () => {
                        state.annualYearsCustom = true;
                        state.years = state.years.filter((y) => y !== year);
                        renderYearList();
                        if (state.currentView === "annual") renderChart();
                    });
                    li.appendChild(btn);
                    listEl.appendChild(li);
                });
            }

            function renderMonthlyYearList() {
                if (!listElMonthly) return;
                listElMonthly.innerHTML = "";
                const yearsToRender = state.monthlyYears || [];
                yearsToRender.forEach((year, idx) => {
                    const li = document.createElement("li");
                    const color = COLOR_PALETTE[idx] || "#666";
                    li.style.background = color;
                    li.style.border = `1px solid ${color}`;
                    li.textContent = String(year);
                    const btn = document.createElement("button");
                    btn.type = "button";
                    btn.textContent = "×";
                    btn.addEventListener("click", () => {
                        state.monthlyYears = state.monthlyYears.filter((y) => y !== year);
                        renderMonthlyYearList();
                        if (state.currentView === "months") renderMonthlyChart();
                    });
                    li.appendChild(btn);
                    listElMonthly.appendChild(li);
                });
            }

            form.addEventListener("submit", (e) => {
                e.preventDefault();
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
                state.annualYearsCustom = true;
                renderYearList();
                if (state.currentView === "annual") renderChart();
                form.reset();
            });

            if (formMonthly) {
                formMonthly.addEventListener("submit", (e) => {
                    e.preventDefault();
                    if (errorElMonthly) errorElMonthly.textContent = "";
                    const year = parseInt(inputMonthly.value.trim(), 10);
                    if (!Number.isInteger(year)) {
                        if (errorElMonthly) errorElMonthly.textContent = "Enter a valid year.";
                        return;
                    }
                    if (!availableYears.has(year)) {
                        if (errorElMonthly) errorElMonthly.textContent = "Year not found in dataset.";
                        return;
                    }
                    if (!state.monthlyYears) state.monthlyYears = [];
                    if (state.monthlyYears.includes(year)) {
                        if (errorElMonthly) errorElMonthly.textContent = "Year already added.";
                        return;
                    }
                    if (state.monthlyYears.length >= MAX_YEARS) {
                        if (errorElMonthly) errorElMonthly.textContent = "Maximum of 10 years.";
                        return;
                    }
                    state.monthlyYears.push(year);
                    state.monthlyYears.sort((a, b) => b - a);
                    renderMonthlyYearList();
                    if (state.currentView === "months") renderMonthlyChart();
                    formMonthly.reset();
                });
            }

            state.threshold = getThreshold();
            applyAnnualPreset();
            updateAnnualModeButtons();
            renderYearList();
            renderMonthlyYearList();
            try {
                if (state.currentView === "annual") renderChart();
                else renderMonthlyChart();
            } catch (err) {
                console.error(err);
                chartEl.innerHTML = `<div style="padding:16px;color:#b00020;">Error: ${err.message}</div>`;
            }
        }).catch((error) => {
            console.error(error);
            const chartEl = document.getElementById("chart");
            if (chartEl) {
                chartEl.innerHTML = `<div style="padding:16px;color:#b00020;">Failed to load data.<br>${error.message || error}</div>`;
            }
        });
    })();
