# Weather site

The original six-page weather site, published at **https://2319bli.github.io/weather-site-k/**.

The HTML, inline chart code, theme choices, default appearance and styles are restored from the original `site/` folder. The original source folder and unrelated local files remain untouched.

## GitHub Pages adaptations

- The three CSV files are copied unchanged into `public/data/`, and page paths point there.
- GitHub Pages cannot run `weather_server.py`. The terminal uses its original browser-storage fallback for saved sessions and presets. Dataset-write commands (`conf`, `upd` followed by `confirm`) report that the Python server is required; they do not simulate edits or change the public CSVs. Queries and rankings work against the published data.
- The deployment workflow validates and uploads only `public/` on pushes to `main`.

There is no added data-processing layer, forced default theme, renamed theme menu, or responsive redesign. The original loaders handle both ISO and day-first CSV dates. Plotly uses the original pinned CDN versions.

## Local preview

```sh
python3 -m http.server 8000 --directory public
```

Open http://localhost:8000. This previews the static Pages version; full server-side dataset updates remain available in the untouched original project using its Python server.

## Validation

```sh
python3 scripts/check-site.py
node --test tests/*.test.cjs
```

The regression checks exercise the original chart loaders against every row of the supplied CET and EWP observations.
