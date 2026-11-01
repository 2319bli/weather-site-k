# Weather Site K

Public site: https://2319bli.github.io/weather-site-k/

Admin terminal: https://weather-site-k-admin.2319bli.workers.dev/terminal.html

The public pages run on GitHub Pages. A Cloudflare Worker serves the password-protected terminal and live CSV data; Cloudflare D1 stores weather updates, three saved terminal sessions, visual presets and expiring login sessions. Updates apply to the temperature, rainfall and threshold pages when those pages are loaded or refreshed. The heat and freeze index pages remain the original precomputed chart exports.

The existing chart calculations and mixed ISO/day-first date parsers are preserved. The historical CSV files in `public/data/` are an unchanged baseline. The Worker appends confirmed observations to that baseline when serving data, overlays forecast updates, and removes forecasts at or before the latest confirmed CET date. New observations must start one day after the latest observation. Concurrent weather edits are rejected rather than overwritten.

## Terminal

Open **Terminal** from the public site and sign in with the admin password. The password is not in this repository or the browser code. Cloudflare stores a salted PBKDF2 verifier as the `ADMIN_PASSWORD_HASH` secret. Login attempts are rate limited; sessions use Secure, HttpOnly, SameSite cookies and expire after eight hours. Every admin API requires a valid session, and writes require a matching Origin. Changing the password invalidates existing sessions.

The existing commands are retained:

- `dat cet`, `dat ewp`: latest observation.
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

To initialise a new production database and deploy the backend:

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

Tests cover every original CET/EWP archive row, date validation, password hashing, protected routes, CSRF checks, login limits, logout, shared saves, forecast updates, concurrent writes and observed/forecast reconciliation. Integration tests use an isolated local database and never change production weather data.

## Branding and colour schemes

The K mark in `public/logo.svg` is the site logo and favicon. Colour schemes are Daybreak, Midnight, Terracotta, Aurora, Atlantic, Eclipse, Amethyst, Meadow and Ember. Atlantic is the default; saved choices retain their existing palette IDs.
