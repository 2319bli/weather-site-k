# Weather Site K

Weather Site K is the original six-page weather site, published at **https://2319bli.github.io/weather-site-k/**.

The original chart calculations, data loaders and terminal behaviour are retained. The shared interface has been redesigned with a clearer archive layout, responsive navigation, accessible controls and nine named colour schemes. The original source folder and unrelated local files remain untouched.

## GitHub Pages adaptations

- The three CSV files are copied unchanged into `public/data/`, and page paths point there.
- GitHub Pages cannot run `weather_server.py`. The terminal uses its original browser-storage fallback for saved sessions and presets. Dataset-write commands (`conf`, `upd` followed by `confirm`) report that the Python server is required; they do not simulate edits or change the public CSVs. Queries and rankings work against the published data.
- The deployment workflow validates and uploads only `public/` on pushes to `main`.

The original loaders handle both ISO and day-first CSV dates. Plotly uses the original pinned CDN versions. The visual redesign does not add a data-processing layer.

## Branding

The K mark in `public/logo.svg` is the shared site logo and SVG favicon. Page headings and functional help remain; decorative taglines and introductory copy are omitted.

## Colour schemes

Daybreak, Midnight, Terracotta, Aurora, Atlantic, Eclipse, Amethyst, Meadow and Ember. Atlantic is the default for new visitors; existing saved choices keep their original palette IDs. The theme menu uses the existing `weather-site-theme` preference. All schemes share the same layout; charts retain their original series colours.

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
