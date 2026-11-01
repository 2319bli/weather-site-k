# Weather Lab

Interactive historical UK weather charts: Central England Temperature (CET), England & Wales Precipitation (EWP), threshold days, heat/freeze excess indices, and a command terminal for rankings and local data exploration.

**Website:** https://2319bli.github.io/weather-site-k/

## Run locally

No build or package installation is needed. From this directory:

```sh
python3 -m http.server 8000 --directory public
```

Open http://localhost:8000. Use an HTTP server rather than opening the HTML files directly, so CSV requests work.

## Structure

- `public/`: the six pages and the only directory deployed to Pages.
- `public/css/`, `public/js/`: page styles, chart behaviour and shared browser storage/data access.
- `public/data/`: the three CSVs used by the charts and terminal.
- `scripts/`, `tests/`: validation and data-storage regression checks.
- `.github/workflows/pages.yml`: validates and publishes pushes to `main`.

The cleaned site was extracted from the latest `site/` version. Old copies, Python utilities, saved terminal history, screenshots, archives, editor settings and unrelated files are intentionally excluded. The source files outside this repository are left untouched.

## Data and local edits

The supplied CET and EWP observations run through **30 October 2026**. Forecasts are the supplied 2026 snapshot; they are not a live weather feed. HEI/FEI are the original embedded historical charts. This cleanup preserves the existing chart calculations.

GitHub Pages is a static host. The terminal's `save`, `savevis`, `conf cet`, `conf ewp`, and `upd` / `confirm` commands save to this browser's local storage. Reload chart pages to apply local data edits. Edits do not update the repository or other visitors, and clearing browser storage removes them. A storage error is reported if persistence is blocked.

To update the public observations or forecasts, edit the corresponding CSV in `public/data/` and push to `main`. Keep `Date,Value` headers for observed datasets and no header for `forecast_2026.csv`. Both `YYYY-MM-DD` and day-first `DD/MM/YYYY` dates are supported, including mixed formats in the historical CET archive. Values must be numeric. Forecast dates on or before the latest CET observation are excluded automatically.

## Checks and deployment

```sh
python3 scripts/check-site.py
node --test tests/*.test.cjs
```

In GitHub Settings → Pages, the source is **GitHub Actions**. The workflow uploads only `public/`; relative asset/data links work under the repository subpath. No Python backend or API keys are required. Plotly is loaded from the existing pinned CDN versions, so an internet connection is required for charts.

Deployment uses GitHub's [custom Pages workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
