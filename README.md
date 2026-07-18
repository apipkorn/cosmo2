# CSD US Content Hub

A modern, responsive web app for browsing and delivering CSD US sales and
marketing assets. The catalog is generated from two source spreadsheets:

- **CSD US template** — defines the folder hierarchy (LEVEL 0–7 columns) and
  the asset IDs published in each folder.
- **Adobe Assets Metadata** — provides, per Celum Asset ID, the title,
  description, download URL, content type, file size and literature number.
  The asset ID embedded in each `multimedia.3m.com/mws/media/<ID>O/…` URL is
  the join key between the two files.

The app is a dependency-free static site (plain HTML/CSS/JS) — host it on any
static web server (GitHub Pages, S3, IIS, nginx…) or open `index.html`
directly in a browser.

## Running locally

```bash
cd content-delivery-app
python3 -m http.server 8080
# open http://localhost:8080
```

## Features

**Content browser**
- Collapsible folder tree with per-folder asset counts, breadcrumbs and
  subfolder cards
- Live global search across titles, descriptions, asset IDs and literature
  numbers (press `/` to focus the search box)
- File-type filter chips (PDF / Video / Image / Document / Archive), type
  icons, file sizes and literature numbers on each asset card
- Open-in-new-tab and copy-link actions per asset
- Fully responsive (drawer navigation on mobile) with light and dark themes

**Admin dashboard** (`#/admin`)
- Password-protected sign-in — the default password is `admin123`;
  change it from the dashboard (**Change password**)
- Add new assets: paste a URL (the asset ID is auto-detected from it), enter
  the title, optional description, and pick the destination folder
- Edit titles/descriptions of any asset; remove assets (with restore) —
  removed assets disappear from the public browser immediately
- Filterable, paginated management table with live/added/removed status
- **Export catalog** downloads the merged catalog (base data + admin changes)
  as JSON

## How data and changes are stored

- `js/data.js` holds the base catalog generated from the spreadsheets.
- Admin changes (additions, edits, removals, password) are stored as an
  overlay in the browser's `localStorage`, so the generated file is never
  mutated. Use **Export catalog** to capture the merged state.

> **Note:** this is a static app, so admin authentication and persistence are
> browser-local (demo-grade). Changes made by an admin are visible in that
> browser only until the exported catalog is republished. For multi-user
> persistence and real access control, put the exported JSON behind a small
> API or rebuild `js/data.js` from updated spreadsheets.

## Regenerating the catalog from new spreadsheets

```bash
pip install openpyxl
python3 scripts/build_data.py "CSD US template.xlsx" "Adobe Assets Metadata.xlsx"
```

This rewrites `js/data.js` (134 folders / 711 assets as of the July 2026
source files). The script warns about any asset IDs referenced by the
template that have no metadata row.
