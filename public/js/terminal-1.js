(() => {
            const DATASETS = {
                cet: {
                    label: "CET",
                    path: "data/MeanTempCET.csv",
                    hasHeader: true
                },
                ewp: {
                    label: "EWP",
                    path: "data/PrecipitationEWP.csv",
                    hasHeader: true
                },
                for: {
                    label: "Forecast",
                    path: "data/forecast_2026.csv",
                    hasHeader: false
                }
            };

            const SAVED_TERMINAL_PREFIX = "weather-terminal-saved-terminal-";
            const VISUAL_PRESETS_KEY = "weather-terminal-visual-presets";
            const WELCOME_TEXT = `Ready.
Commands:
dat cet
dat ewp
save
savevis spring
run spring
vis
rank table cet year high 10
rank graph ewp win6 low 4
conf cet "
15/05/2026 9.2
"
conf ewp "
2026-05-08 0.4
"
view for 15/05/2026-22/05/2026
view cet 01/05/2026-17/05/2026
view ewp 01/05/2026-17/05/2026
upd "
2026-05-18 12.3
19/05/2026 13.7
"`;
            const outputEl = document.getElementById("terminal-output");
            const visualHeaderEl = document.getElementById("visual-output-header");
            const visualBodyEl = document.getElementById("visual-output-body");
            const inputEl = document.getElementById("terminal-input");
            const formEl = document.getElementById("terminal-form");
            const clearEl = document.getElementById("clear-output");
            const terminalTabs = [...document.querySelectorAll(".terminal-tab")];

            const state = {
                rows: {},
                memoryVisualPresets: {},
                visualPresets: {},
                lastVisualCommand: null,
                activeTerminal: 0,
                terminals: Array.from({ length: 3 }, (_, index) => ({
                    entries: loadSavedTerminal(index),
                    pendingUpdate: null
                }))
            };

            function requestText(url) { return WeatherData.loadText(url); }

            function storageGet(key) { return WeatherData.get(key); }
            function storageSet(key, value) { WeatherData.set(key, value); }

            function loadVisualPresets() {
                try {
                    const raw = typeof window.localStorage === "undefined"
                        ? JSON.stringify(state.memoryVisualPresets)
                        : storageGet(VISUAL_PRESETS_KEY) || "{}";
                    const presets = JSON.parse(raw);
                    if (!presets || typeof presets !== "object" || Array.isArray(presets)) return {};
                    return Object.fromEntries(
                        Object.entries(presets).filter(([name, command]) => {
                            return isValidPresetName(name) && typeof command === "string" && isVisualCommand(command);
                        })
                    );
                } catch {
                    return {};
                }
            }

            function saveVisualPresets() {
                if (typeof window.localStorage === "undefined") {
                    state.memoryVisualPresets = { ...state.visualPresets };
                    return;
                }
                storageSet(VISUAL_PRESETS_KEY, JSON.stringify(state.visualPresets));
            }

            function isValidPresetName(name) {
                return /^[A-Za-z0-9_-]{1,32}$/.test(name);
            }

            function isVisualCommand(command) {
                return /^rank\b/i.test(command.trim());
            }

            state.visualPresets = loadVisualPresets();

            function loadSavedTerminal(index) {
                try {
                    const raw = typeof window.localStorage === "undefined"
                        ? null
                        : storageGet(`${SAVED_TERMINAL_PREFIX}${index}`);
                    const entries = JSON.parse(raw || "[]");
                    if (!Array.isArray(entries)) return [];
                    return entries.filter((entry) => {
                        return entry &&
                            typeof entry.input === "string" &&
                            typeof entry.response === "string";
                    }).slice(-5);
                } catch {
                    return [];
                }
            }

            function currentTerminal() {
                return state.terminals[state.activeTerminal];
            }

            function renderTerminal() {
                const terminal = currentTerminal();
                const transcript = terminal.entries.map((entry) => `> ${entry.input}\n${entry.response}`).join("\n\n");
                outputEl.textContent = transcript || WELCOME_TEXT;
                outputEl.scrollTop = outputEl.scrollHeight;
                terminalTabs.forEach((tab, index) => {
                    tab.setAttribute("aria-selected", String(index === state.activeTerminal));
                });
            }

            function appendOutput(input, response) {
                if (input) {
                    currentTerminal().entries.push({ input, response });
                    renderTerminal();
                    return;
                }
                outputEl.textContent += `\n${response}`;
                outputEl.scrollTop = outputEl.scrollHeight;
            }

            function invalid() {
                return "Invalid input";
            }

            function escapeHtml(value) {
                return String(value).replace(/[&<>"']/g, (char) => ({
                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    "\"": "&quot;",
                    "'": "&#39;"
                }[char]));
            }

            function parseIsoDate(value) {
                const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
                if (!match) return null;
                const year = Number(match[1]);
                const month = Number(match[2]);
                const day = Number(match[3]);
                const date = new Date(Date.UTC(year, month - 1, day));
                if (
                    date.getUTCFullYear() !== year ||
                    date.getUTCMonth() !== month - 1 ||
                    date.getUTCDate() !== day
                ) {
                    return null;
                }
                return date;
            }

            function parseUserDate(value) {
                const dmyMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
                const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
                if (!dmyMatch && !isoMatch) return null;
                const year = Number(dmyMatch ? dmyMatch[3] : isoMatch[1]);
                const month = Number(dmyMatch ? dmyMatch[2] : isoMatch[2]);
                const day = Number(dmyMatch ? dmyMatch[1] : isoMatch[3]);
                const date = new Date(Date.UTC(year, month - 1, day));
                if (
                    date.getUTCFullYear() !== year ||
                    date.getUTCMonth() !== month - 1 ||
                    date.getUTCDate() !== day
                ) {
                    return null;
                }
                return date;
            }

            function isoFromDate(date) {
                return date.toISOString().slice(0, 10);
            }

            function addDays(date, days) {
                const next = new Date(date.getTime());
                next.setUTCDate(next.getUTCDate() + days);
                return next;
            }

            function displayDate(iso) {
                const date = parseIsoDate(iso);
                if (!date) return iso;
                const day = String(date.getUTCDate()).padStart(2, "0");
                const month = String(date.getUTCMonth() + 1).padStart(2, "0");
                const year = date.getUTCFullYear();
                return `${day}/${month}/${year}`;
            }

            function parseCsv(text, hasHeader) {
                const lines = text.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
                const dataLines = hasHeader ? lines.slice(1) : lines;
                return dataLines.map((line) => {
                    const parts = line.split(",");
                    if (parts.length < 2) return null;
                    const date = parseUserDate(parts[0].trim());
                    const iso = date ? isoFromDate(date) : null;
                    const value = Number(parts[1].trim());
                    if (!iso || !Number.isFinite(value)) return null;
                    return { iso, value };
                }).filter(Boolean);
            }

            async function loadDataset(key) {
                const dataset = DATASETS[key];
                state.rows[key] = parseCsv(await requestText(dataset.path), dataset.hasHeader);
            }

            async function ensureData() {
                const keys = Object.keys(DATASETS);
                await Promise.all(keys.map((key) => state.rows[key] ? null : loadDataset(key)));
            }

            function loadForecastUpdates() { return WeatherData.updates('for'); }
            function saveForecastUpdates(updates) { WeatherData.saveUpdates('for', updates); }

            function forecastRowsWithUpdates() {
                const merged = new Map(state.rows.for.map((row) => [row.iso, row.value]));
                Object.entries(loadForecastUpdates()).forEach(([iso, value]) => {
                    merged.set(iso, value);
                });
                return [...merged.entries()]
                    .map(([iso, value]) => ({ iso, value }))
                    .filter(row => row.iso > latestRow(state.rows.cet).iso)
                    .sort((a, b) => a.iso.localeCompare(b.iso));
            }

            function rowsForKey(key) {
                return key === "for" ? forecastRowsWithUpdates() : state.rows[key];
            }

            const MONTH_PERIODS = {
                jan: { label: "January", months: [1] },
                feb: { label: "February", months: [2] },
                mar: { label: "March", months: [3] },
                apr: { label: "April", months: [4] },
                may: { label: "May", months: [5] },
                jun: { label: "June", months: [6] },
                jul: { label: "July", months: [7] },
                aug: { label: "August", months: [8] },
                sep: { label: "September", months: [9] },
                oct: { label: "October", months: [10] },
                nov: { label: "November", months: [11] },
                dec: { label: "December", months: [12] }
            };

            const SEASON_PERIODS = {
                spr: { label: "Spring", months: [3, 4, 5] },
                sum: { label: "Summer", months: [6, 7, 8] },
                aut: { label: "Autumn", months: [9, 10, 11] },
                win: { label: "Winter", months: [12, 1, 2], winter: true }
            };

            const HEX_SEASON_PERIODS = {
                win6: { label: "Winter", months: [1, 2] },
                spr6: { label: "Spring", months: [3, 4] },
                pra6: { label: "Prasiner", months: [5, 6] },
                xan6: { label: "Xanther", months: [7, 8] },
                aut6: { label: "Autumn", months: [9, 10] },
                pha6: { label: "Phaier", months: [11, 12] }
            };

            function periodFromCode(code) {
                const normalized = code.toLowerCase();
                if (normalized === "year") return { code: normalized, label: "Year", months: null };
                return MONTH_PERIODS[normalized] ||
                    SEASON_PERIODS[normalized] ||
                    HEX_SEASON_PERIODS[normalized] ||
                    null;
            }

            function periodYearForDate(date, period) {
                if (!period.months) return date.getUTCFullYear();
                const month = date.getUTCMonth() + 1;
                if (!period.months.includes(month)) return null;
                if (period.winter && month === 12) return date.getUTCFullYear() + 1;
                return date.getUTCFullYear();
            }

            function metricForValues(datasetKey, values) {
                if (!values.length) return null;
                const total = values.reduce((sum, value) => sum + value, 0);
                return datasetKey === "cet" ? total / values.length : total;
            }

            function valueUnit(datasetKey) {
                return datasetKey === "cet" ? "°C" : " mm";
            }

            function formatRankValue(datasetKey, value) {
                const digits = datasetKey === "cet" ? 2 : 1;
                return `${Number(value).toFixed(digits)}${valueUnit(datasetKey)}`;
            }

            function periodRankRows(datasetKey, period) {
                const buckets = new Map();
                rowsForKey(datasetKey).forEach((row) => {
                    const date = parseIsoDate(row.iso);
                    if (!date) return;
                    const year = periodYearForDate(date, period);
                    if (year === null) return;
                    if (!buckets.has(year)) buckets.set(year, []);
                    buckets.get(year).push(row.value);
                });
                return [...buckets.entries()]
                    .map(([year, values]) => ({
                        year,
                        label: `${period.label} ${year}`,
                        value: metricForValues(datasetKey, values)
                    }))
                    .filter((row) => row.value !== null && Number.isFinite(row.value));
            }

            function applyModuloRanking(rows, modulus) {
                const buckets = new Map();
                rows.forEach((row) => {
                    const remainder = ((row.year % modulus) + modulus) % modulus;
                    if (!buckets.has(remainder)) buckets.set(remainder, []);
                    buckets.get(remainder).push(row.value);
                });
                return [...buckets.entries()].map(([remainder, values]) => ({
                    year: remainder,
                    label: `mod ${modulus} = ${remainder}`,
                    value: values.reduce((sum, value) => sum + value, 0) / values.length
                }));
            }

            function latestRow(rows) {
                return rows.reduce((latest, row) => {
                    return !latest || row.iso > latest.iso ? row : latest;
                }, null);
            }

            function formatRows(label, rows) {
                if (!rows.length) return `${label}: no data found`;
                const header = `${label}\nDate        Value\n----------  -----`;
                const body = rows.map((row) => `${displayDate(row.iso)}  ${row.value}`).join("\n");
                return `${header}\n${body}`;
            }

            function handleDat(command) {
                const match = /^dat\s+(cet|ewp)$/i.exec(command);
                if (!match) return null;
                const key = match[1].toLowerCase();
                const row = latestRow(state.rows[key]);
                if (!row) return invalid();
                return `${DATASETS[key].label}: ${displayDate(row.iso)} ${row.value}`;
            }

            function handleView(command) {
                const match = /^view\s+(for|forecast|cet|ewp)\s+(\d{2}\/\d{2}\/\d{4})-(\d{2}\/\d{2}\/\d{4})$/i.exec(command);
                if (!match) return null;
                const key = match[1].toLowerCase() === "forecast" ? "for" : match[1].toLowerCase();
                const start = parseUserDate(match[2]);
                const end = parseUserDate(match[3]);
                if (!start || !end || start > end) return invalid();
                const startIso = isoFromDate(start);
                const endIso = isoFromDate(end);
                const rows = rowsForKey(key).filter((row) => row.iso >= startIso && row.iso <= endIso);
                return formatRows(DATASETS[key].label, rows);
            }

            function parseRankCommand(command) {
                const match = /^rank\s+(table|graph)\s+(cet|ewp)\s+("[^"]+"|\u201C[^\u201D]+\u201D|[a-z0-9]+)\s+(high|low)\s+(\d+)(?:\s+mod\s+(\d+))?$/i.exec(command);
                if (!match) return null;
                const view = match[1].toLowerCase();
                const datasetKey = match[2].toLowerCase();
                const code = match[3].replace(/^["\u201C]|["\u201D]$/g, "").toLowerCase();
                const direction = match[4].toLowerCase();
                const count = Number(match[5]);
                const modulus = match[6] ? Number(match[6]) : null;
                const period = periodFromCode(code);
                if (!period || !Number.isInteger(count) || count < 1 || count > 100) return false;
                if (modulus !== null && (!Number.isInteger(modulus) || modulus < 2 || modulus > 1000)) return false;
                return { view, datasetKey, period, direction, count, modulus };
            }

            function rankedRowsForCommand(parsed) {
                let rows = periodRankRows(parsed.datasetKey, parsed.period);
                if (parsed.modulus !== null) rows = applyModuloRanking(rows, parsed.modulus);
                rows.sort((a, b) => {
                    const diff = parsed.direction === "high" ? b.value - a.value : a.value - b.value;
                    return diff || a.year - b.year;
                });
                return rows.slice(0, parsed.count).map((row, index) => ({
                    ...row,
                    rank: index + 1
                }));
            }

            function renderRankTable(parsed, rows) {
                visualHeaderEl.textContent = `${DATASETS[parsed.datasetKey].label} Rank Table`;
                visualBodyEl.classList.add("has-visual");
                const body = rows.map((row) => `
                    <tr>
                        <td>${row.rank}</td>
                        <td>${escapeHtml(row.label)}</td>
                        <td>${escapeHtml(formatRankValue(parsed.datasetKey, row.value))}</td>
                    </tr>
                `).join("");
                visualBodyEl.innerHTML = `
                    <p class="rank-chart-title">${escapeHtml(parsed.period.label)} ${parsed.direction === "high" ? "highest" : "lowest"} ${parsed.count}${parsed.modulus ? `, mod ${parsed.modulus}` : ""}</p>
                    <table class="rank-table">
                        <thead>
                            <tr><th>Rank</th><th>Data</th><th>Value</th></tr>
                        </thead>
                        <tbody>${body}</tbody>
                    </table>
                `;
            }

            function renderRankGraph(parsed, rows) {
                visualHeaderEl.textContent = `${DATASETS[parsed.datasetKey].label} Rank Graph`;
                visualBodyEl.classList.add("has-visual");
                const bars = rows.slice();
                if (!bars.length) {
                    visualBodyEl.innerHTML = "No data found.";
                    return;
                }

                const width = 760;
                const height = 420;
                const pad = { left: 64, right: 28, top: 32, bottom: 92 };
                const ys = bars.map((row) => row.value);
                const minY = Math.min(...ys);
                const maxY = Math.max(...ys);
                const ySpan = maxY - minY || 1;
                const yMin = Math.min(0, minY - ySpan * 0.08);
                const yMax = maxY + ySpan * 0.08;
                const chartWidth = width - pad.left - pad.right;
                const chartHeight = height - pad.top - pad.bottom;
                const slotWidth = chartWidth / bars.length;
                const barWidth = Math.max(12, Math.min(54, slotWidth * 0.66));
                const yFor = (y) => pad.top + ((yMax - y) / (yMax - yMin)) * (height - pad.top - pad.bottom);
                const yTicks = Array.from({ length: 5 }, (_, index) => yMin + ((yMax - yMin) * index / 4));
                const xLabelFor = (row) => parsed.modulus ? String(row.year) : String(row.year);
                const barNodes = bars.map((row, index) => {
                    const x = pad.left + slotWidth * index + (slotWidth - barWidth) / 2;
                    const y = yFor(row.value);
                    const baseY = yFor(0);
                    const h = Math.max(1, Math.abs(baseY - y));
                    const labelAngle = bars.length > 8 ? ` transform="rotate(-45 ${x + barWidth / 2} ${height - 48})"` : "";
                    return `
                        <rect class="bar" x="${x.toFixed(1)}" y="${Math.min(y, baseY).toFixed(1)}" width="${barWidth.toFixed(1)}" height="${h.toFixed(1)}">
                            <title>${escapeHtml(row.label)}: ${escapeHtml(formatRankValue(parsed.datasetKey, row.value))}</title>
                        </rect>
                        <text x="${(x + barWidth / 2).toFixed(1)}" y="${height - 48}" text-anchor="${bars.length > 8 ? "end" : "middle"}"${labelAngle}>${escapeHtml(xLabelFor(row))}</text>
                    `;
                }).join("");
                const tickNodes = yTicks.map((tick) => {
                    const y = yFor(tick);
                    return `
                        <line class="grid" x1="${pad.left}" x2="${width - pad.right}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}"></line>
                        <text x="${pad.left - 10}" y="${(y + 4).toFixed(1)}" text-anchor="end">${tick.toFixed(parsed.datasetKey === "cet" ? 1 : 0)}</text>
                    `;
                }).join("");

                visualBodyEl.innerHTML = `
                    <p class="rank-chart-title">${escapeHtml(parsed.period.label)} ${parsed.direction === "high" ? "highest" : "lowest"} ${parsed.count}${parsed.modulus ? `, mod ${parsed.modulus}` : ""}</p>
                    <svg class="rank-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Rank graph">
                        ${tickNodes}
                        <line class="axis" x1="${pad.left}" x2="${width - pad.right}" y1="${height - pad.bottom}" y2="${height - pad.bottom}"></line>
                        <line class="axis" x1="${pad.left}" x2="${pad.left}" y1="${pad.top}" y2="${height - pad.bottom}"></line>
                        ${barNodes}
                        <text x="${(pad.left + width - pad.right) / 2}" y="${height - 10}" text-anchor="middle">${parsed.modulus ? "Modulo bucket" : "Ranked year"}</text>
                        <text x="18" y="${(pad.top + height - pad.bottom) / 2}" transform="rotate(-90 18 ${(pad.top + height - pad.bottom) / 2})" text-anchor="middle">Value (${escapeHtml(valueUnit(parsed.datasetKey).trim())})</text>
                    </svg>
                `;
            }

            function handleRank(command) {
                if (!/^rank\b/i.test(command)) return null;
                const parsed = parseRankCommand(command);
                if (!parsed) return invalid();
                const rows = rankedRowsForCommand(parsed);
                if (!rows.length) return invalid();
                if (parsed.view === "table") {
                    renderRankTable(parsed, rows);
                } else {
                    renderRankGraph(parsed, rows);
                }
                state.lastVisualCommand = command.trim();
                return `Rendered rank ${parsed.view}: ${DATASETS[parsed.datasetKey].label} ${parsed.period.label}.`;
            }

            function handleSaveVisual(command) {
                const match = /^savevis\s+([A-Za-z0-9_-]{1,32})$/i.exec(command);
                if (!match) return null;
                if (!state.lastVisualCommand) return invalid();
                const name = match[1];
                state.visualPresets[name] = state.lastVisualCommand;
                saveVisualPresets();
                return `Saved visual preset ${name}: ${state.lastVisualCommand}`;
            }

            function handleListVisuals(command) {
                if (!/^vis$/i.test(command)) return null;
                const entries = Object.entries(state.visualPresets).sort((a, b) => a[0].localeCompare(b[0]));
                if (!entries.length) return "No visual presets saved.";
                return `Visual presets\n${entries.map(([name, presetCommand]) => `${name}: ${presetCommand}`).join("\n")}`;
            }

            function handleDeleteVisual(command) {
                const match = /^delvis\s+([A-Za-z0-9_-]{1,32})$/i.exec(command);
                if (!match) return null;
                const name = match[1];
                if (!Object.prototype.hasOwnProperty.call(state.visualPresets, name)) return invalid();
                delete state.visualPresets[name];
                saveVisualPresets();
                return `Deleted visual preset ${name}.`;
            }

            function handleRunVisual(command) {
                const match = /^run\s+([A-Za-z0-9_-]{1,32})$/i.exec(command);
                if (!match) return null;
                const name = match[1];
                const presetCommand = state.visualPresets[name];
                if (!presetCommand) return invalid();
                const response = handleRank(presetCommand);
                if (!response || response === invalid()) return invalid();
                return `Ran visual preset ${name}: ${presetCommand}`;
            }

            function linesFromBody(body) {
                return body.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").map((line) => line.trim()).filter(Boolean);
            }

            function stripOptionalQuotes(body) {
                const trimmed = body.trim();
                if (
                    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
                    (trimmed.startsWith("\u201C") && trimmed.endsWith("\u201D"))
                ) {
                    return trimmed.slice(1, -1);
                }
                if (trimmed.startsWith("\"") || trimmed.startsWith("\u201C")) {
                    return trimmed.slice(1);
                }
                return trimmed;
            }

            function parseDataLines(lines) {
                if (!lines.length) return { ok: false, reason: "No data lines found." };
                const updates = [];
                const seen = new Set();
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const lineMatch = /^(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})\s+(-?\d+(?:\.\d+)?)$/.exec(line);
                    if (!lineMatch) {
                        return { ok: false, reason: `Line ${i + 1} is not valid: "${line}". Expected: date followed by a value (e.g., 2026-05-20 14.4).` };
                    }
                    const date = parseUserDate(lineMatch[1]);
                    const value = Number(lineMatch[2]);
                    if (!date || !Number.isFinite(value)) {
                        return { ok: false, reason: `Line ${i + 1} has an invalid date or value: "${line}".` };
                    }
                    const iso = isoFromDate(date);
                    if (seen.has(iso)) {
                        return { ok: false, reason: `Line ${i + 1} is a duplicate date: ${iso}.` };
                    }
                    seen.add(iso);
                    updates.push({ iso, value, valueText: lineMatch[2] });
                }
                return { ok: true, updates };
            }

            function parseUpdate(command) {
                const match = /^upd(?:\s+for)?\b\s*([\s\S]*)$/i.exec(command);
                if (!match) return null;
                const lines = linesFromBody(stripOptionalQuotes(match[1]));
                const parsed = parseDataLines(lines);
                if (!parsed.ok) return { error: parsed.reason };
                const updates = parsed.updates;
                const latestCet = latestRow(state.rows.cet);
                if (!latestCet) return { error: "CET data not loaded." };
                const bad = updates.find((row) => row.iso <= latestCet.iso);
                if (bad) {
                    return { error: `Forecast date ${bad.iso} must be after the latest observed CET date (${latestCet.iso}).` };
                }
                updates.sort((a, b) => a.iso.localeCompare(b.iso));
                return { ok: true, updates };
            }

            function parseConfirmObserved(command) {
                const match = /^conf\s+(cet|ewp)\b\s*([\s\S]*)$/i.exec(command);
                if (!match) return null;
                const key = match[1].toLowerCase();
                const lines = linesFromBody(stripOptionalQuotes(match[2]));
                const parsed = parseDataLines(lines);
                if (!parsed.ok) return { error: parsed.reason };
                const updates = parsed.updates;

                const latest = latestRow(state.rows[key]);
                if (!latest) return { error: `${DATASETS[key].label} data not loaded.` };
                const expectedFirst = isoFromDate(addDays(parseIsoDate(latest.iso), 1));
                if (updates[0].iso !== expectedFirst) {
                    return { error: `First date must be exactly one day after the latest ${DATASETS[key].label} date. Expected: ${expectedFirst}, got: ${updates[0].iso}.` };
                }

                for (let index = 1; index < updates.length; index += 1) {
                    if (updates[index].iso <= updates[index - 1].iso) {
                        return { error: `Dates must be in ascending order. Problem at line ${index + 1}: ${updates[index].iso} is not after ${updates[index - 1].iso}.` };
                    }
                }

                return { ok: true, key, updates };
            }

            function handleUpdate(command) {
                if (!/^upd\b/i.test(command)) return null;
                const result = parseUpdate(command);
                if (result.error) return `Invalid input: ${result.error}`;
                const updates = result.updates;
                currentTerminal().pendingUpdate = updates;
                return `Confirm forecast update?\n${formatRows("Pending forecast", updates)}\nType confirm to apply.`;
            }

            async function handleObservedConfirm(command) {
                if (!/^conf\b/i.test(command)) return null;
                const parsed = parseConfirmObserved(command);
                if (parsed && parsed.error) return `Invalid input: ${parsed.error}`;
                if (!parsed || !parsed.ok) return invalid();
                const updates = WeatherData.updates(parsed.key);
                parsed.updates.forEach(row => { updates[row.iso] = row.value; });
                WeatherData.saveUpdates(parsed.key, updates);
                await loadDataset(parsed.key);
                if (parsed.key === 'cet') await loadDataset('for');
                return `${DATASETS[parsed.key].label}: saved ${parsed.updates.length} local entr${parsed.updates.length === 1 ? 'y' : 'ies'}. Reload charts to see your edits. Public CSVs are unchanged.`;
            }

            async function applyPendingUpdate() {
                const terminal = currentTerminal();
                if (!terminal.pendingUpdate) return invalid();
                const latest = latestRow(state.rows.cet).iso;
                if (terminal.pendingUpdate.some(row => row.iso <= latest)) {
                    return 'Observed data has advanced. Cancel and enter forecast dates after ' + latest + '.';
                }
                const updates = loadForecastUpdates();
                terminal.pendingUpdate.forEach(row => { updates[row.iso] = row.value; });
                saveForecastUpdates(updates);
                const count = terminal.pendingUpdate.length;
                terminal.pendingUpdate = null;
                return `Forecast saved locally: ${count} entr${count === 1 ? 'y' : 'ies'}. Reload charts to see your edits. Public CSVs are unchanged.`;
            }

            async function saveCurrentTerminal() {
                const terminal = currentTerminal();
                const entries = terminal.entries.slice(-5);
                storageSet(`${SAVED_TERMINAL_PREFIX}${state.activeTerminal}`, JSON.stringify(entries));
                terminal.entries = entries;
                return `Saved ${entries.length} message${entries.length === 1 ? '' : 's'} locally for Terminal ${state.activeTerminal + 1}.`;
            }

            async function runCommand(rawInput) {
                const command = rawInput.trim();
                if (!command) return invalid();

                if (/^save$/i.test(command)) return saveCurrentTerminal();
                const saveVisualResponse = handleSaveVisual(command);
                if (saveVisualResponse !== null) return saveVisualResponse;
                const listVisualResponse = handleListVisuals(command);
                if (listVisualResponse !== null) return listVisualResponse;
                const deleteVisualResponse = handleDeleteVisual(command);
                if (deleteVisualResponse !== null) return deleteVisualResponse;
                await ensureData();

                const runVisualResponse = handleRunVisual(command);
                if (runVisualResponse !== null) return runVisualResponse;
                if (/^confirm$/i.test(command)) return applyPendingUpdate();
                if (/^cancel$/i.test(command)) {
                    if (!currentTerminal().pendingUpdate) return invalid();
                    currentTerminal().pendingUpdate = null;
                    return "Update cancelled.";
                }

                return handleDat(command) ||
                    handleView(command) ||
                    handleRank(command) ||
                    await handleObservedConfirm(command) ||
                    handleUpdate(command) ||
                    invalid();
            }

            formEl.addEventListener("submit", async (event) => {
                event.preventDefault();
                const command = inputEl.value;
                inputEl.value = "";
                try {
                    appendOutput(command.trim(), await runCommand(command));
                } catch (error) {
                    appendOutput(command.trim(), `Error: ${error?.message || "An unexpected error occurred."}`);
                }
            });

            inputEl.addEventListener("keydown", (event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                    formEl.requestSubmit();
                }
            });

            clearEl.addEventListener("click", () => {
                currentTerminal().entries = [];
                currentTerminal().pendingUpdate = null;
                renderTerminal();
            });

            terminalTabs.forEach((tab) => {
                tab.addEventListener("click", async () => {
                    state.activeTerminal = Number(tab.dataset.terminal);
                    renderTerminal();
                });
            });

            renderTerminal();
        })();
