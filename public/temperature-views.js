/* Extra temperature views; the existing cumulative renderers remain in temperature.html. */
(function () {
    const A = window.CETAnalysis;
    const dateLabel = iso => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'
    });
    const temperature = value => `${value.toFixed(2)}°C`;

    window.CETViews = {
        create(observedRows, forecastRows, chart, summary, colours, redraw) {
            const archive = A.createArchive(observedRows);
            const modes = {}, recordYears = {};
            const buttons = [...document.querySelectorAll('[data-chart-mode]')];
            const dailyControls = document.getElementById('daily-controls');
            const recordSelect = document.getElementById('record-year');
            const showRecords = document.getElementById('show-daily-records');
            const extra = document.getElementById('temperature-details');
            const forecastSummary = document.getElementById('forecast-summary');
            const mobile = window.matchMedia('(max-width: 760px)');
            let currentView = 'annual';

            buttons.forEach(button => button.addEventListener('click', () => {
                modes[currentView] = button.dataset.chartMode;
                redraw();
            }));
            showRecords.addEventListener('change', redraw);
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
                    xaxis, yaxis: { title: ylabel, zeroline: false },
                    margin: { l: 58, r: 20, t: 65, b: 130 },
                    legend: { orientation: 'h', x: 0, y: -0.2, yanchor: 'top', traceorder: 'normal',
                        entrywidthmode: 'fraction', entrywidth: mobile.matches ? 0.5 : 0.25,
                        font: { size: mobile.matches ? 10 : 11 } },
                    hovermode: 'closest'
                }, { responsive: true, displaylogo: false, toImageButtonOptions: {
                    filename: `cet-${currentView}-${modes[currentView]}`, width: 1400, height: 800, scale: 2
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
                    for (const [bound, name, colour] of [['low', 'Coldest daily', '#3985cb'], ['high', 'Warmest daily', '#d77831']]) {
                        traces.push({ x, y: data.records.map(row => row ? row[bound] : null), type: 'scatter', mode: 'lines', name,
                            line: { color: colour, width: 1.2 },
                            ...(bound === 'high' ? { fill: 'tonexty', fillcolor: 'rgba(128,128,128,0.10)' } : {}),
                            text: data.calendar.map((day, index) => `${day.label}<br>${name}<br>Years: ${data.records[index]?.[`${bound}Years`].join(', ') || '—'}`),
                            hovertemplate: '%{text}<br>%{y:.1f}°C<extra></extra>' });
                    }
                }
                for (const [index, series] of data.series.entries()) {
                    const colour = colours[index % colours.length];
                    const focused = showRecords.checked && series.year === recordYear;
                    if (series.observed.some(Boolean)) traces.push({
                        x, y: series.observed.map(row => row?.value ?? null), type: 'scatter', mode: 'lines',
                        name: String(series.year), line: { color: colour, width: focused ? 3 : 1.6 }, connectgaps: false,
                        text: series.observed.map(row => row ? dateLabel(row.iso) : ''),
                        hovertemplate: '%{text}<br>Daily CET: %{y:.1f}°C<extra>%{fullData.name}</extra>'
                    });
                    if (series.forecast.some(Boolean)) {
                        const forecast = series.forecast.slice();
                        const first = forecast.findIndex(Boolean);
                        if (first > 0 && series.observed[first - 1]) forecast[first - 1] = series.observed[first - 1];
                        traces.push({ x, y: forecast.map(row => row?.value ?? null), type: 'scatter', mode: 'lines+markers',
                            name: `${series.year} forecast`, line: { color: colour, width: 2, dash: 'dot' },
                            marker: { size: 3 }, connectgaps: false,
                            text: forecast.map(row => row ? `${dateLabel(row.iso)}${row === series.observed[first - 1] ? ' · observed' : ' · forecast'}` : ''),
                            hovertemplate: '%{text}<br>Daily CET: %{y:.1f}°C<extra></extra>' });
                    }
                }
                if (showRecords.checked) {
                    const records = A.heldRecords(archive, period, recordYear);
                    for (const kind of ['Warmest', 'Coldest']) {
                        const held = records.filter(row => row.kind === kind);
                        if (held.length) traces.push({ x: held.map(row => row.x), y: held.map(row => row.value),
                            type: 'scatter', mode: 'markers', name: `${recordYear} ${kind === 'Warmest' ? 'warm' : 'cold'} records`,
                            marker: { color: '#35a96f', size: 11, symbol: kind === 'Warmest' ? 'triangle-up' : 'triangle-down',
                                line: { color: '#15462c', width: 1 } },
                            text: held.map(row => `${dateLabel(row.iso)}<br>${kind}${row.tied ? ' (tied)' : ''}<br>Record years: ${row.years.join(', ')}`),
                            hovertemplate: '%{text}<br>%{y:.1f}°C<extra></extra>' });
                    }
                    const warm = records.filter(row => row.kind === 'Warmest').length;
                    extra.innerHTML = `<details open class="temperature-records"><summary>Records held by ${recordYear} · ${records.length}</summary><p class="hint">${warm} warmest · ${records.length - warm} coldest. Records still held in the full observed archive, including ties.</p>${records.length ? table(['Date', 'Daily CET', 'Record', 'Record years'], records.map(row => [dateLabel(row.iso), `${row.value.toFixed(1)}°C`, `${row.kind}${row.tied ? ' (tied)' : ''}`, row.years.join(', ')]), 'Daily CET records') : '<p>No daily records held in this period.</p>'}</details>`;
                }
                const ticks = data.calendar.filter(day => day.day === 1);
                plot(traces, `${period.label} · Daily CET`, {
                    title: period.months.length === 1 ? 'Day of month' : '',
                    tickangle: 0, tickfont: { size: mobile.matches ? 10 : 12 },
                    ...(period.months.length > 1 ? { tickmode: 'array', tickvals: ticks.map(day => day.x), ticktext: ticks.map(day => day.label.slice(2)) } : {}),
                    range: [1, data.calendar.length]
                }, 'Daily mean temperature (°C)');
                summary.textContent = `Observed data through ${dateLabel(archive.latest)}. Forecasts are dotted and excluded from records.${period.winter ? ' Winter is labelled by the January/February year.' : ''}`;
            }

            function renderHistory(period) {
                const rows = A.history(archive, period);
                const complete = rows.filter(row => row.complete);
                const incomplete = rows.filter(row => !row.complete);
                const ranked = complete.slice().sort((a, b) => b.mean - a.mean);
                const detail = row => `${period.label} ${row.year}<br>${temperature(row.mean)}<br>${row.days}/${row.expected} observed days<br>${dateLabel(row.first)} – ${dateLabel(row.last)}${row.complete ? `<br>Warmth rank: ${row.rank} of ${complete.length}` : '<br>Incomplete · not ranked'}`;
                const traces = [{ x: rows.map(row => row.year), y: rows.map(row => row.complete ? row.mean : null),
                    type: 'scatter', mode: 'lines+markers', name: 'Complete periods',
                    line: { color: '#3985cb', width: 1.3 }, marker: { size: 4 }, connectgaps: false,
                    text: rows.map(detail), hovertemplate: '%{text}<extra></extra>' }];
                if (incomplete.length) traces.push({ x: incomplete.map(row => row.year), y: incomplete.map(row => row.mean),
                    type: 'scatter', mode: 'markers', name: 'Incomplete periods',
                    marker: { color: '#d77831', size: 10, symbol: 'diamond-open', line: { width: 2 } },
                    text: incomplete.map(detail), hovertemplate: '%{text}<extra></extra>' });
                for (const [name, extreme, colour] of [['Warmest', ranked[0], '#d77831'], ['Coldest', ranked.at(-1), '#35a96f']]) {
                    const tied = extreme ? complete.filter(row => Math.abs(row.mean - extreme.mean) < 1e-10) : [];
                    if (tied.length) traces.push({ x: tied.map(row => row.year), y: tied.map(row => row.mean),
                        type: 'scatter', mode: 'markers', name, marker: { color: colour, size: 9 },
                        text: tied.map(detail), hovertemplate: '%{text}<extra></extra>' });
                }
                plot(traces, `${period.label} · Historical comparison`, { title: 'Year', dtick: 25, tickformat: 'd' }, 'Period mean temperature (°C)');
                summary.textContent = complete.length
                    ? `${complete.length} complete periods. Warmest: ${ranked.filter(row => row.rank === 1).map(row => row.year).join(', ')} (${temperature(ranked[0].mean)}). Coldest: ${complete.filter(row => Math.abs(row.mean - ranked.at(-1).mean) < 1e-10).map(row => row.year).join(', ')} (${temperature(ranked.at(-1).mean)}).`
                    : 'No complete periods available.';
                if (incomplete.length) summary.textContent += ' Hollow diamonds show incomplete periods; these are not ranked against complete periods.';
                if (period.winter) summary.textContent += ' Winter is labelled by the January/February year.';
                extra.innerHTML = `<details><summary>All years · values and rankings</summary><p class="hint">Observed daily CET only. Forecasts excluded. Rank 1 is warmest; ties share a rank.</p>${table(['Year', 'Mean CET', 'Observed days', 'Warmth rank'], rows.slice().reverse().map(row => [row.year, temperature(row.mean), `${row.days}/${row.expected}${row.complete ? '' : ` · incomplete<br>${dateLabel(row.first)} – ${dateLabel(row.last)}`}`, row.rank ?? '—']), 'Historical CET means')}</details>`;
            }

            return {
                render(view, selection, years) {
                    currentView = view;
                    const mode = modes[view] || 'cumulative';
                    document.body.dataset.temperatureMode = mode;
                    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.chartMode === mode)));
                    dailyControls.hidden = mode !== 'daily';
                    extra.replaceChildren();
                    if (mode === 'cumulative') return false;
                    forecastSummary.textContent = '';
                    const period = A.period(view, selection);
                    if (mode === 'daily') renderDaily(period, years);
                    else renderHistory(period);
                    return true;
                }
            };
        }
    };
})();
