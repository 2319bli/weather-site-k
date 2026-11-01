/* Year selection and traces shared by the three individual-period views. */
(function (root) {
    const PALETTE = ['#3985cb', '#d77831', '#21966d', '#9762c3', '#c34e76', '#1697a6', '#847141', '#c64f43', '#6278b6', '#6c9360'];

    function createSelection() {
        let available = [], selected = [];
        const slots = new Map();
        function add(year) {
            if (!available.includes(year) || selected.includes(year) || selected.length >= PALETTE.length) return false;
            const used = new Set(selected.map(year => slots.get(year)));
            if (!slots.has(year) || used.has(slots.get(year))) slots.set(year, PALETTE.findIndex((_, i) => !used.has(i)));
            selected.push(year);
            return true;
        }
        return {
            update(years, preferred) {
                available = [...new Set(years.filter(Number.isInteger))].sort((a,b) => b-a);
                selected = selected.filter(year => available.includes(year));
                if (!selected.length) add(available.includes(preferred) ? preferred : available[0]);
                return selected.slice();
            },
            add,
            remove(year) {
                if (selected.length <= 1 || !selected.includes(year)) return false;
                selected = selected.filter(value => value !== year);
                return true;
            },
            years: () => selected.slice(),
            choices: () => available.filter(year => !selected.includes(year)),
            colour: year => PALETTE[slots.get(year)],
            full: () => selected.length >= PALETTE.length
        };
    }

    function createYearPicker(container, prefix, onChange) {
        const selection = createSelection();
        const form = document.createElement('form');
        const label = document.createElement('label');
        label.htmlFor = `${prefix}-year`;
        label.append(document.createTextNode('Add year '));
        const select = document.createElement('select'); select.id = `${prefix}-year`;
        label.append(select);
        const add = document.createElement('button'); add.type = 'submit'; add.textContent = 'Add'; add.id = `${prefix}-add-year`;
        const note = document.createElement('span'); note.className = 'hint'; note.textContent = 'Up to 10 years';
        const list = document.createElement('ul'); list.id = `${prefix}-years`; list.className = 'individual-years'; list.setAttribute('aria-label', 'Compared years');
        form.append(label, add, note); container.replaceChildren(form, list);
        function paint() {
            const previous = Number(select.value), choices = selection.choices();
            select.replaceChildren(...choices.map(year => new Option(String(year), String(year))));
            if (choices.includes(previous)) select.value = String(previous);
            select.disabled = add.disabled = selection.full() || !choices.length;
            list.replaceChildren(...selection.years().map(year => {
                const item = document.createElement('li');
                const swatch = document.createElement('span'); swatch.className = 'year-swatch'; swatch.style.backgroundColor = selection.colour(year); swatch.setAttribute('aria-hidden','true');
                const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.setAttribute('aria-label', `Remove ${year}`);
                remove.disabled = selection.years().length === 1;
                remove.title = remove.disabled ? 'Keep at least one year selected.' : `Remove ${year}`;
                remove.addEventListener('click', () => { if (selection.remove(year)) { paint(); onChange(); } });
                item.append(swatch, document.createTextNode(String(year)), remove);
                return item;
            }));
        }
        form.addEventListener('submit', event => {
            event.preventDefault();
            if (selection.add(Number(select.value))) { paint(); onChange(); }
        });
        return {
            update(years, preferred) { const result = selection.update(years, preferred); paint(); return result; },
            colour: selection.colour
        };
    }

    function traces(series, kind, labels, formatDate) {
        const temperature = kind === 'temperature', sunshine = kind === 'sunshine';
        const unit = temperature ? '°C' : sunshine ? ' hours' : ' mm';
        return series.map(({year, colour, rows}) => ({
            x: labels, y: rows.map(row => row.value), name: String(year), legendgroup: String(year),
            text: rows.map(row => `${row.label} ${year}<br>${formatDate(row.start)} – ${formatDate(row.end)}<br>${row.days ?? row.count}/${row.expected} ${sunshine ? 'months' : 'observed days'}${row.complete ? '' : '<br>Incomplete period'}`),
            hovertemplate: `%{text}<br>${temperature ? 'Mean CET' : sunshine ? 'Sunshine' : 'Total rainfall'}: %{y:.${sunshine ? 1 : 2}f}${unit}<extra></extra>`,
            ...(temperature ? {
                type: 'scatter', mode: 'lines+markers', connectgaps: false, line: { color: colour, width: 2 },
                marker: { color: colour, size: 8, symbol: rows.map(row => row.complete ? 'circle' : 'diamond-open') }
            } : {
                type: 'bar', textposition: 'none', offsetgroup: String(year), alignmentgroup: 'individual-periods',
                marker: { color: colour, pattern: { shape: rows.map(row => (row.days ?? row.count) && !row.complete ? '/' : '') } }
            })
        }));
    }
    const api = { createSelection, createYearPicker, traces };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.IndividualComparison = api;
})(typeof window !== 'undefined' ? window : globalThis);
