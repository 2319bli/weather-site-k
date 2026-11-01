/* Shared daily, historical and individual-period views. Existing CET/EWP cumulative renderers remain in their pages. */
(function () {
    const A = window.CETAnalysis;
    const dateLabel = iso => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'
    });

    window.WeatherViews = window.CETViews = {
        create(observedRows, forecastRows, chart, summary, colours, redraw, kind = 'temperature') {
            const rainfall = kind === 'rainfall';
            const unit = rainfall ? ' mm' : '°C';
            const precision = rainfall ? 2 : 1;
            const format = value => Number.isFinite(value) ? `${value.toFixed(2)}${unit}` : '—';
            const dailyLabel = rainfall ? 'Daily rainfall' : 'Daily CET';
            const highLabel = rainfall ? 'Wettest' : 'Warmest';
            const lowLabel = rainfall ? 'Driest' : 'Coldest';
            const rankLabel = rainfall ? 'Wetness rank' : 'Warmth rank';
            const dailyBounds = rainfall ? [['high', 'Wettest daily', '#3985cb']]
                : [['low', 'Coldest daily', '#3985cb'], ['high', 'Warmest daily', '#d77831']];
            const archive = A.createArchive(observedRows);
            const modes = {}, recordYears = {}, historyRanges = {};
            const buttons = [...document.querySelectorAll('[data-chart-mode]')];
            const dailyControls = document.getElementById('daily-controls');
            const historyControls = document.getElementById('history-controls');
            const individualControls = document.getElementById('individual-controls');
            const individualSelect = document.getElementById('individual-year');
            const historyNote = document.getElementById('history-range-note');
            const rangeButtons = [...document.querySelectorAll('[data-history-range]')];
            const recordSelect = document.getElementById('record-year');
            const showRecords = document.getElementById('show-daily-records');
            const extra = document.getElementById(`${kind}-details`);
            const forecastSummary = document.getElementById('forecast-summary');
            const mobile = window.matchMedia('(max-width: 760px)');
            let currentView = 'annual';
            let individualYear = Number(archive.latest?.slice(0, 4));

            buttons.forEach(button => button.addEventListener('click', () => {
                modes[currentView] = button.dataset.chartMode;
                redraw();
            }));
            rangeButtons.forEach(button => button.addEventListener('click', () => {
                historyRanges[currentView] = button.dataset.historyRange;
                redraw();
            }));
            showRecords.addEventListener('change', redraw);
            individualSelect?.addEventListener('change', () => { individualYear = Number(individualSelect.value); redraw(); });
            recordSelect.addEventListener('change', () => {
                recordYears[currentView] = Number(recordSelect.value);
                redraw();
            });
            mobile.addEventListener('change', () => {
                if (modes[currentView] && modes[currentView] !== 'cumulative') redraw();
            });

            function table(headers, rows, label) {
                return `<div class="temperature-table-scroll" tabindex="0" role="region" aria-label="${label}"><table class="rank-table"><thead><tr>${headers.map(h => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
            }

            function plot(traces, title, xaxis, ylabel) {
                chart.textContent = '';
                Plotly.newPlot(chart, traces, {
                    title: { text: title, font: { size: 18 } },
                    xaxis, yaxis: { title: ylabel, zeroline: false, ...(rainfall ? { rangemode: 'tozero' } : {}) },
                    margin: { l: 58, r: 20, t: 65, b: 130 },
                    legend: { orientation: 'h', x: 0, y: -0.2, yanchor: 'top', traceorder: 'normal',
                        entrywidthmode: 'fraction', entrywidth: mobile.matches ? 0.5 : 0.25,
                        font: { size: mobile.matches ? 10 : 11 } },
                    hovermode: 'closest', barmode: 'overlay'
                }, { responsive: true, displaylogo: false, toImageButtonOptions: {
                    filename: `${rainfall ? 'ewp' : 'cet'}-${currentView}-${modes[currentView]}`, width: 1400, height: 800, scale: 2
                } });
            }

            function renderDaily(period, selectedYears) {
                const available = A.years(archive, period).reverse();
                if (!available.includes(recordYears[currentView])) recordYears[currentView] = available[0];
                const recordYear = recordYears[currentView];
                recordSelect.replaceChildren(...available.map(year => new Option(String(year), String(year), false, year === recordYear)));
                recordSelect.disabled = !showRecords.checked;
                const years = [...selectedYears];
                if (showRecords.checked && recordYear && !years.includes(recordYear)) years.push(recordYear);
                const data = A.daily(archive, period, years, forecastRows);
                const x = data.calendar.map(day => day.x);
                const traces = [];
                if (showRecords.checked) {
                    for (const [bound, name, colour] of dailyBounds) {
                        traces.push({ x, y: data.records.map(row => row ? row[bound] : null), type: 'scatter', mode: 'lines', name,
                            line: { color: colour, width: 1.2 },
                            ...(bound === 'high' ? { fill: rainfall ? 'tozeroy' : 'tonexty', fillcolor: 'rgba(128,128,128,0.10)' } : {}),
                            text: data.calendar.map((day, index) => `${day.label}<br>${name}<br>Years: ${data.records[index]?.[`${bound}Years`].join(', ') || '—'}`),
                            hovertemplate: `%{text}<br>%{y:.${precision}f}${unit}<extra></extra>` });
                    }
                }
                for (const [index, series] of data.series.entries()) {
                    const colour = colours[index % colours.length];
                    const focused = showRecords.checked && series.year === recordYear;
                    if (series.observed.some(Boolean)) traces.push({
                        x, y: series.observed.map(row => row?.value ?? null), type: 'scatter', mode: 'lines',
                        name: String(series.year), line: { color: colour, width: focused ? 3 : 1.6 }, connectgaps: false,
                        text: series.observed.map(row => row ? dateLabel(row.iso) : ''),
                        hovertemplate: `%{text}<br>${dailyLabel}: %{y:.${precision}f}${unit}<extra>%{fullData.name}</extra>`
                    });
                    if (series.forecast.some(Boolean)) {
                        const forecast = series.forecast.slice();
                        const first = forecast.findIndex(Boolean);
                        if (first > 0 && series.observed[first - 1]) forecast[first - 1] = series.observed[first - 1];
                        traces.push({ x, y: forecast.map(row => row?.value ?? null), type: 'scatter', mode: 'lines+markers',
                            name: `${series.year} forecast`, line: { color: colour, width: 2, dash: 'dot' },
                            marker: { size: 3 }, connectgaps: false,
                            text: forecast.map(row => row ? `${dateLabel(row.iso)}${row === series.observed[first - 1] ? ' · observed' : ' · forecast'}` : ''),
                            hovertemplate: `%{text}<br>${dailyLabel}: %{y:.${precision}f}${unit}<extra></extra>` });
                    }
                }
                if (showRecords.checked) {
                    const records = A.heldRecords(archive, period, recordYear)
                        .filter(row => !rainfall || row.bound === 'high')
                        .map(row => ({ ...row, kind: row.bound === 'high' ? highLabel : lowLabel }));
                    for (const kind of rainfall ? [highLabel] : [highLabel, lowLabel]) {
                        const held = records.filter(row => row.kind === kind);
                        if (held.length) traces.push({ x: held.map(row => row.x), y: held.map(row => row.value),
                            type: 'scatter', mode: 'markers', name: `${recordYear} ${rainfall ? 'wettest' : kind === highLabel ? 'warm' : 'cold'} records`,
                            marker: { color: '#35a96f', size: 11, symbol: kind === highLabel ? 'triangle-up' : 'triangle-down',
                                line: { color: '#15462c', width: 1 } },
                            text: held.map(row => `${dateLabel(row.iso)}<br>${kind}${row.tied ? ' (tied)' : ''}<br>Record years: ${row.years.join(', ')}`),
                            hovertemplate: `%{text}<br>%{y:.${precision}f}${unit}<extra></extra>` });
                    }
                    const warm = records.filter(row => row.kind === highLabel).length;
                    const recordCounts = rainfall ? `${warm} wettest-date records.` : `${warm} warmest · ${records.length - warm} coldest.`;
                    extra.innerHTML = `<details open class="temperature-records"><summary>Records held by ${recordYear} · ${records.length}</summary><p class="hint">${recordCounts} Records still held in the full observed archive, including ties.</p>${records.length ? table(['Date', dailyLabel, 'Record', 'Record years'], records.map(row => [dateLabel(row.iso), `${row.value.toFixed(precision)}${unit}`, `${row.kind}${row.tied ? ' (tied)' : ''}`, row.years.join(', ')]), `${dailyLabel} records`) : '<p>No daily records held in this period.</p>'}</details>`;
                }
                const ticks = data.calendar.filter(day => day.day === 1);
                plot(traces, `${period.label} · ${dailyLabel}`, {
                    title: period.months.length === 1 ? 'Day of month' : '',
                    tickangle: 0, tickfont: { size: mobile.matches ? 10 : 12 },
                    ...(period.months.length > 1 ? { tickmode: 'array', tickvals: ticks.map(day => day.x), ticktext: ticks.map(day => day.label.slice(2)) } : {}),
                    range: [1, data.calendar.length]
                }, rainfall ? 'Daily rainfall (mm)' : 'Daily mean temperature (°C)');
                summary.textContent = `Observed data through ${dateLabel(archive.latest)}. ${rainfall ? 'Records use observed rainfall only.' : 'Forecasts are dotted and excluded from records.'}${period.winter ? ' Winter is labelled by the January/February year.' : ''}`;
            }

            function renderHistory(period) {
                const toDate = historyRanges[currentView] === 'ytd';
                const rangeLabel = currentView === 'annual' ? 'Year to date' : 'Period to date';
                const comparison = toDate ? A.historyToDate(archive, period, rainfall ? 'total' : 'mean') : null;
                const rows = comparison ? comparison.rows : A.history(archive, period, rainfall ? 'total' : 'mean');
                if (historyNote) historyNote.textContent = comparison?.expected
                    ? `${dateLabel(comparison.start)} – ${dateLabel(comparison.end)} · ${comparison.expected} matching calendar dates in each year. 29 February excluded. Data through ${dateLabel(comparison.cutoff)}.` : '';
                if (comparison && !comparison.expected) {
                    Plotly.purge(chart);
                    const message = document.createElement('p');
                    message.className = 'history-empty';
                    message.textContent = `No observations for ${period.label} ${comparison.referenceYear} yet.`;
                    chart.replaceChildren(message);
                    summary.textContent = `Observed data through ${dateLabel(comparison.cutoff)}. Choose Full period to see earlier years for this period.`;
                    return;
                }
                const complete = rows.filter(row => row.complete);
                const incomplete = rows.filter(row => !row.complete);
                const ranked = complete.slice().sort((a, b) => b.value - a.value);
                const detail = row => `${period.label} ${row.year}<br>${format(row.value)}<br>${row.days}/${row.expected} observed days<br>${dateLabel(row.windowStart || row.first)} – ${dateLabel(row.windowEnd || row.last)}${row.complete ? `<br>${rankLabel}: ${row.rank} of ${complete.length}` : '<br>Incomplete · not ranked'}`;
                const traces = [{ x: rows.map(row => row.year), y: rows.map(row => row.complete ? row.value : null),
                    type: 'scatter', mode: 'lines+markers', name: toDate ? 'Matching dates' : 'Complete periods',
                    line: { color: '#3985cb', width: 1.3 }, marker: { size: 4 }, connectgaps: false,
                    text: rows.map(detail), hovertemplate: '%{text}<extra></extra>' }];
                if (incomplete.length) traces.push({ x: incomplete.map(row => row.year), y: incomplete.map(row => row.value),
                    type: 'scatter', mode: 'markers', name: toDate ? 'Missing data' : 'Incomplete periods',
                    marker: { color: '#d77831', size: 10, symbol: 'diamond-open', line: { width: 2 } },
                    text: incomplete.map(detail), hovertemplate: '%{text}<extra></extra>' });
                for (const [name, extreme, colour] of [[highLabel, ranked[0], '#d77831'], [lowLabel, ranked.at(-1), '#35a96f']]) {
                    const tied = extreme ? complete.filter(row => Math.abs(row.value - extreme.value) < 1e-10) : [];
                    if (tied.length) traces.push({ x: tied.map(row => row.year), y: tied.map(row => row.value),
                        type: 'scatter', mode: 'markers', name, marker: { color: colour, size: 9 },
                        text: tied.map(detail), hovertemplate: '%{text}<extra></extra>' });
                }
                const reference = comparison && rows.find(row => row.year === comparison.referenceYear);
                if (reference && Number.isFinite(reference.value)) traces.push({ x: [reference.year], y: [reference.value],
                    type: 'scatter', mode: 'markers', name: `${reference.year} · ${rangeLabel.toLowerCase()}`,
                    marker: { color: '#a970d6', size: 13, symbol: 'circle-open', line: { width: 2.5 } },
                    text: [detail(reference)], hovertemplate: '%{text}<extra></extra>' });
                plot(traces, `${period.label} · ${toDate ? rangeLabel : 'Historical comparison'}`, { title: 'Year', dtick: rainfall ? 10 : 25, tickformat: 'd' }, rainfall ? 'Period rainfall total (mm)' : 'Period mean temperature (°C)');
                summary.textContent = complete.length
                    ? `${complete.length} complete ${toDate ? 'comparisons' : 'periods'}. ${highLabel}: ${ranked.filter(row => row.rank === 1).map(row => row.year).join(', ')} (${format(ranked[0].value)}). ${lowLabel}: ${complete.filter(row => Math.abs(row.value - ranked.at(-1).value) < 1e-10).map(row => row.year).join(', ')} (${format(ranked.at(-1).value)}).`
                    : `No complete ${toDate ? 'comparisons' : 'periods'} available.`;
                if (incomplete.length) summary.textContent += toDate
                    ? ' Years with missing observations are unranked; hollow diamonds show their available data.'
                    : ' Hollow diamonds show incomplete periods; these are not ranked against complete periods.';
                if (reference) summary.textContent = `${reference.year}: ${format(reference.value)}. ${reference.complete ? `${rankLabel}: ${reference.rank} of ${complete.length}.` : `${reference.days}/${reference.expected} observed days; not ranked.`} ${summary.textContent}`;
                if (period.winter) summary.textContent += ' Winter is labelled by the January/February year.';
                extra.innerHTML = `<details><summary>All years · values and rankings</summary><p class="hint">${rainfall ? 'Observed rainfall only. Projections excluded.' : 'Observed daily CET only. Forecasts excluded.'} Rank 1 is ${highLabel.toLowerCase()}; ties share a rank.${toDate ? ' All years use the matching dates shown above; 29 February is excluded.' : ''}</p>${table(['Year', rainfall ? 'Total rainfall' : 'Mean CET', 'Observed days', rankLabel], rows.slice().reverse().map(row => [row.year, format(row.value), `${row.days}/${row.expected}${row.complete ? '' : row.first ? ` · incomplete<br>${dateLabel(row.first)} – ${dateLabel(row.last)}` : ' · no observations'}`, row.rank ?? '—']), rainfall ? 'Historical rainfall totals' : 'Historical CET means')}</details>`;
            }

            function renderIndividual() {
                const available = [...new Set(A.periods(currentView).flatMap(period => A.years(archive, period)))].sort((a,b) => b-a);
                if (!available.includes(individualYear)) individualYear = available[0];
                individualSelect.replaceChildren(...available.map(year => new Option(String(year), String(year), false, year === individualYear)));
                const rows = A.breakdown(archive, currentView, individualYear, rainfall ? 'total' : 'mean');
                const labels = { months: 'Monthly', seasons: 'Seasonal', 'hex-seasons': 'Hex-season' };
                const detail = row => `${row.label} ${row.year}<br>${dateLabel(row.start)} – ${dateLabel(row.end)}<br>${row.days}/${row.expected} observed days${row.complete ? '' : row.days ? '<br>Incomplete period' : '<br>No observations'}`;
                const trace = {
                    x: rows.map(row => row.label), y: rows.map(row => row.value), name: String(individualYear),
                    text: rows.map(detail), hovertemplate: `%{text}<br>${rainfall ? 'Total rainfall' : 'Mean CET'}: %{y:.2f}${unit}<extra></extra>`,
                    ...(rainfall ? { type: 'bar', textposition: 'none', marker: { color: '#3985cb', pattern: { shape: rows.map(row => row.days && !row.complete ? '/' : '') } } }
                        : { type: 'scatter', mode: 'lines+markers', connectgaps: false, line: { color: '#3985cb', width: 2 },
                            marker: { size: 8, symbol: rows.map(row => row.complete ? 'circle' : 'diamond-open'), color: rows.map(row => row.complete ? '#3985cb' : '#d77831') } })
                };
                plot([trace], `${individualYear} · ${labels[currentView]} ${rainfall ? 'rainfall totals' : 'mean CET'}`, {
                    type: 'category', categoryorder: 'array', categoryarray: rows.map(row => row.label), tickangle: 0,
                    tickfont: { size: mobile.matches ? 9 : 12 }
                }, rainfall ? 'Total rainfall (mm)' : 'Mean temperature (°C)');
                summary.textContent = `${individualYear} · ${rows.filter(row => row.complete).length} of ${rows.length} periods complete. Observations only.${currentView === 'seasons' ? ' Winter includes the preceding December.' : ''}`;
                if (rows.some(row => row.days && !row.complete)) summary.textContent += rainfall
                    ? ' Hatched bars show incomplete totals.' : ' Hollow diamonds show means for incomplete periods.';
                if (rows.some(row => !row.days)) summary.textContent += ' Periods without observations are left blank.';
                extra.innerHTML = `<details><summary>${individualYear} · individual values</summary>${table(['Period', rainfall ? 'Total rainfall' : 'Mean CET', 'Observed days', 'Date range'], rows.map(row => [row.label, format(row.value), `${row.days}/${row.expected}${row.complete ? '' : row.days ? ' · incomplete' : ' · no observations'}`, `${dateLabel(row.start)} – ${dateLabel(row.end)}`]), `${individualYear} period breakdown`)}</details>`;
            }

            return {
                render(view, selection, years) {
                    currentView = view;
                    const mode = modes[view] || 'cumulative';
                    document.body.dataset[`${kind}Mode`] = mode;
                    buttons.forEach(button => {
                        button.setAttribute('aria-pressed', String(button.dataset.chartMode === mode));
                        if (button.dataset.chartMode === 'individual') button.hidden = view === 'annual';
                    });
                    dailyControls.hidden = mode !== 'daily';
                    if (individualControls) individualControls.hidden = mode !== 'individual';
                    if (historyControls) historyControls.hidden = mode !== 'historical';
                    rangeButtons.forEach(button => {
                        button.setAttribute('aria-pressed', String(button.dataset.historyRange === (historyRanges[view] || 'full')));
                        if (button.dataset.historyRange === 'ytd') button.textContent = view === 'annual' ? 'Year to date' : 'Period to date';
                    });
                    extra.replaceChildren();
                    if (mode === 'cumulative') return false;
                    if (forecastSummary) forecastSummary.textContent = '';
                    if (mode === 'individual') { renderIndividual(); return true; }
                    const period = A.period(view, selection);
                    if (mode === 'daily') renderDaily(period, years);
                    else renderHistory(period);
                    return true;
                }
            };
        }
    };
})();
