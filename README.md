# Weather Site K

Public site: https://2319bli.github.io/weather-site-k/

Admin terminal: https://weather-site-k-admin.2319bli.workers.dev/terminal.html

The public pages run on GitHub Pages. A Cloudflare Worker serves the password-protected terminal and live CSV data; Cloudflare D1 stores weather updates, three saved terminal sessions, visual presets and expiring login sessions. The homepage overview and all six chart pages read server data when loaded or refreshed. The original temperature charts are at `temperature.html`; `index.html` is the overview. The heat and freeze indices use their separate annual hottest/coldest records, including location, rather than daily mean CET.

The existing chart calculations and mixed ISO/day-first date parsers are preserved. The historical CSV files in `public/data/` are an unchanged baseline. The Worker appends confirmed observations to that baseline when serving data, overlays forecast updates, and removes forecasts at or before the latest confirmed CET date. New observations must start one day after the latest observation. Annual extreme records are seeded from the unchanged `hottest_days.csv` and `coldest_days.csv` files; D1 stores replacements by year. Their charts, hover details, top-ten tables and year ranges are calculated from those shared records, using the original HEI = Σ(temperature − 27°C) and FEI = Σ(−temperature − 8°C) formulas. Concurrent weather edits are rejected rather than overwritten.

## Homepage overview

The overview selects the latest observed year by default and lets visitors choose another year or refresh the server data. It shows year-to-date CET, rainfall and sunshine, their archive rankings, monthly comparisons, the last 30 days, daily highs/lows, the longest run with EWP below 1 mm, and the annual hottest/coldest records. It shows each series' actual observation cut-off and excludes forecasts.

Comparisons use matching calendar dates and a 1991–2020 reference average. Leap day is omitted from period comparisons; daily highlights retain it. Incomplete historical windows are excluded from rankings, and incomplete selected periods receive no rank or anomaly. January's last-30-day window includes the preceding December. Missing observations break dry runs. The monthly chart also has an expandable table of exact figures.

Sunshine uses the same four-region dropdown as the sunshine page: UK wide, England, England and Wales, and Midlands. Its summary shows sunshine hours, percentage of the 1991–2020 average and the sunniest-year rank, using January through that region’s latest confirmed month in the selected year. A sunshine option in Month by month and two columns in Monthly figures use the same region. Complete historical years use published annual totals; missing months remain unranked, and years before 1910 show no sunshine data. The Charts link carries the selected region to the sunshine page. Refresh data reloads sunshine from the server alongside the other series; switching region fetches only sunshine and retains the selected year.

## Temperature views

Annual, monthly, seasonal and hex-seasonal charts each offer **Cumulative average**, **Daily CET** and **Historical comparison**, retaining the selected mode within each tab. Cumulative averages keep the original calculations and year controls. Daily CET uses those same selected years, with dotted forecasts shown separately.

Daily records show the archive's warmest and coldest daily mean for each calendar date, a shaded range, and the record holders on hover. Select a record year to highlight its still-standing records and list their dates, temperatures and all tied holders. The selected record year is also drawn even when it is outside the year list. Switch off **Show daily records** for just the selected years. This feature follows the daily-record view in [WeatherArchives](https://pr-141.github.io/WeatherArchives/cet_mean_daily_extremes.html), using Weather Site K's live CET archive.

Historical comparison plots the observed mean of the chosen period for every archive year, with a values/rankings table. Only complete periods are ranked; incomplete periods use hollow diamonds and show their observed coverage. Forecasts never enter the record range, record holders or historical means. Daily curves align by calendar date, with a gap on 29 February in non-leap years. Winter is labelled by its January/February year and includes the preceding December. Historical period means include leap day when present.

## Rainfall views

The rainfall page offers **Cumulative total**, **Daily rainfall** and **Historical comparison** for annual, monthly, seasonal and hex-seasonal periods. The existing cumulative totals, projections and year presets are preserved. Daily rainfall shows observed EWP amounts, with optional wettest-date records, a record-year selector and tied record holders. Historical comparison shows each period's total rainfall across all archive years, with wettest/driest highlights and a values/rankings table. Incomplete periods are marked separately and unranked. Daily and historical modes exclude the cumulative view's climatological projections.

Both pages share calendar and view helpers (retaining their original `temperature-*.js` filenames for existing pages). Rainfall uses totals in mm; temperature uses means in °C. The server data, mixed date parser, leap-day alignment and winter-year convention are retained.

### Historical comparison to date

On either page, historical comparison defaults to **Full period**. Choose **Year to date** in the annual tab to compare 1 January through that dataset's latest observed date in every year. The latest year gets a separate marker and rank. CET and EWP use their own observation cutoffs. The setting is remembered separately for each period tab during the visit.

The other tabs call this **Period to date**: the selected month, season or hex-season is clipped to the observation cutoff in the reference year. Finished periods use their complete window; future periods show an explicit empty state. Winter includes the preceding December, and a December cutoff belongs to the winter ending the following year. Each comparison displays its date window and day count.

To-date comparisons exclude 29 February from every year, so all years use the same calendar dates. Years with missing observations are shown separately and unranked; an entirely missing period is not zero rainfall. Forecasts and projections are excluded. Full-period statistics and cumulative charts retain their original treatment of leap days and their original values.

## Sunshine

`sunshine.html` compares sunshine totals in hours across all years from 1910, with annual, monthly, seasonal and hex-seasonal periods. The dataset selector offers UK wide, England, England and Wales, and Midlands. There is only historical comparison because these sources contain monthly totals. Full-period comparisons mark incomplete years separately and leave them unranked; year/period-to-date compares the same available months in every year. Rankings share ties. A values table, sunniest/dullest highlights and a 1991–2020 average accompany the chart.

The baseline files in `public/data/sunshine/` are unchanged copies of the Met Office HadUK-Grid [UK](https://www.metoffice.gov.uk/pub/data/weather/uk/climate/datasets/Sunshine/date/UK.txt), [England](https://www.metoffice.gov.uk/pub/data/weather/uk/climate/datasets/Sunshine/date/England.txt), [England and Wales](https://www.metoffice.gov.uk/pub/data/weather/uk/climate/datasets/Sunshine/date/England_and_Wales.txt) and [Midlands](https://www.metoffice.gov.uk/pub/data/weather/uk/climate/datasets/Sunshine/date/Midlands.txt) files, updated 1 October 2026 and containing monthly observations through September 2026. Fixed-width parsing preserves blank future months and missing aggregates. Published complete annual/seasonal totals are retained; hex-season totals and newly completed periods sum the rounded monthly values. Winter uses the preceding December. Small rounding differences from published aggregates are expected.

Each region has separate D1 state, served publicly at `/data/sunuk.json`, `/data/suneng.json`, `/data/suneaw.json` and `/data/sunmid.json`. Refreshing the page reads the current server data. Sources are fixed baselines; later confirmations are stored on the server rather than automatically fetched from Met Office.

Use `dat sunuk`, `dat suneng`, `dat suneaw` or `dat sunmid` to inspect the latest confirmed month. Confirm the next month with, for example, `conf sunuk "2026-10 86.3"` (illustrative value only). Replace `sunuk` with `suneng`, `suneaw` or `sunmid` for the other regions. Each line is `YYYY-MM hours`; quoted multiline input is supported. Commands save immediately, like `conf cet`, and require consecutive months following the latest observation. Existing months cannot be overwritten. Invalid months, negative/non-numeric values, totals exceeding the month's hours and stale concurrent edits are rejected. No example values are written to production by deployment.

## Terminal

Open **Terminal** from the public site and sign in with the admin password. The password is not in this repository or the browser code. Cloudflare stores a salted PBKDF2 verifier as the `ADMIN_PASSWORD_HASH` secret. Login attempts are rate limited; sessions use Secure, HttpOnly, SameSite cookies and expire after eight hours. Every admin API requires a valid session, and writes require a matching Origin. Changing the password invalidates existing sessions.

The existing commands are retained:

- `dat cet`, `dat ewp`: latest observation.
- `dat hei`, `dat fei`: latest annual extreme record; `view hei 2026` or `view fei 2026` reads a specific year.
- `upd hei "13/08/2026 38.2 Hartpury College"` or `upd fei "06/01/2026 -12.5 Marham (Norfolk)"`, then `confirm`: preview and save an annual record. Each line supplies a full date, temperature and location. ISO and day-first dates are accepted. One record per year is retained: existing years are replaced, new years are added. `cancel` discards the preview.
- `view cet 01/01/1800-02/01/1800`: query dates using the original date syntax.
- `conf cet "..."` / `conf ewp "..."`: append confirmed observations.
- `upd "..."`, then `confirm`: save forecast changes.
- `save`: store the last five messages in the selected terminal on the server.
- `savevis name`, `run name`, `vis`, `delvis name`: shared visual presets.

Saved messages and presets belong to this shared admin account. Previous browser-only history is not uploaded automatically. This is a weather command interface, not an operating-system shell.

## Development and deployment

Requires Node.js 24 and a Cloudflare account with access to the Worker and database declared in `wrangler.jsonc`.

```sh
npm ci
npm run prepare:worker
npx wrangler login
npx wrangler d1 execute weather-site-k --local --file worker/schema.sql
npm run dev:worker
```

For local sign-in, set a **test-only** verifier in ignored `.dev.vars` as `ADMIN_PASSWORD_HASH=...`. Generate the verifier with the exported `passwordHash` function in `worker/auth.mjs`; never put the real password in a command argument or source file.

To initialise or update the production schema and deploy the backend:

```sh
npx wrangler d1 execute weather-site-k --remote --file worker/schema.sql
npm run deploy:worker
node scripts/set-admin-password.mjs
```

The password command prompts with hidden input and sends only its salted verifier to Cloudflare. Use it again to rotate the password. Database schema creation is idempotent. Worker redeployments preserve the D1 database. Keep the archive baseline fixed; routine weather edits go through the terminal.

Push `main` to run validation and deploy `public/` to GitHub Pages. Worker source changes are deployed separately with `npm run deploy:worker`; GitHub does not hold a Cloudflare account credential. The original local project and unrelated files are untouched.

## Validation

```sh
npm run prepare:worker
python3 scripts/check-site.py
npm test
```

Dashboard tests check independently calculated archive statistics, partial periods, ties, leap days, year boundaries and missing data. Tests compare every original HEI/FEI bar against the Python exports and cover annual replacements, leap days, rankings, every original CET/EWP archive row, date validation, password hashing, protected routes, CSRF checks, login limits, logout, shared saves, forecast updates, concurrent writes and observed/forecast reconciliation. Integration tests use an isolated local database and never change production weather data.

Temperature tests cover calendar alignment, winter boundaries, tied and superseded daily records, forecast exclusion, complete and incomplete historical periods, duplicate observations and independently grouped archive values. Browser checks compare cumulative trace values before and after the new view controls and exercise every mode, record selection, period selectors and mobile layouts.

Rainfall tests distinguish period totals from daily means, preserve zero rainfall and wettest-record ties, and compare all annual, February, winter and Phaier totals against independent sums from the full EWP archive. Browser checks cover all 12 rainfall modes, unchanged cumulative values, record toggles, year controls, period selectors and mobile layouts, along with temperature regressions.

To-date tests cover differing observation cutoffs, both directions of leap-year comparison, gaps, zero rainfall, winter boundaries, future periods and independent CET/EWP archive calculations. Browser checks compare full-period charts before and after the change and verify the new values and ranks against the live observation responses on both pages.

## Branding and colour schemes

The K mark in `public/logo.svg` is the site logo and favicon. Colour schemes are Daybreak, Midnight, Terracotta, Aurora, Atlantic, Eclipse, Amethyst, Meadow and Ember. Atlantic is the default; saved choices retain their existing palette IDs.

Sunshine tests verify every imported monthly cell and published aggregate, period totals, fixed-width missing columns, ties, incomplete periods, matching-month comparisons, winter rollover, strict monthly command syntax, region isolation, authentication, CSRF and concurrent updates. Terminal-handler integration tests use an isolated database.
