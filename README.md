# CSD Content Hub

A phone, tablet and web app for browsing 3M Commercial Solutions literature and
videos. It is a separate project from the existing 3M™ COSMO app; "CSD Content
Hub" is a working name (see [Renaming](#renaming)).

All content comes from two spreadsheets in this repository. Change a
spreadsheet, and the app picks up the change the next time it opens. No app
release is needed and there is no server to look after.

```
content/   the two spreadsheets you edit
tools/     turns the spreadsheets into catalog.json, and checks them
app/       the app itself (Expo / React Native, TypeScript)
thumbs/    preview images, named <asset ID>.jpg
```

## Changing content

Edit the files in `content/` and commit the change to `main`.

**`content/assets.csv`** has one row per PDF, video or other item.

| Column | Notes |
|---|---|
| ID | Required and unique. The Celum asset ID. |
| Title | Required. |
| Description | Optional. Searchable. |
| Type | `PDF`, `Video`, `Image`, `Presentation`, `Document`, `Archive` or `Link`. Guessed from the URL if blank. |
| URL | Required, must start with `https://`. For videos, the player link. |
| Folders | Where it appears. Levels are separated by ` > `, and several folders by `;`. Example: `Products > Films; Training` |
| Literature Number, Size (bytes), Created | Optional details shown on the item's page. |
| YouTube ID | Optional. Gives a video a preview image. |
| Status | `live` (default) or `hidden`. Hidden rows stay in the spreadsheet but not in the app. |
| Notes | For you. Never shown in the app. |

**`content/folders.csv`** lists the folders in the order they should appear,
with an optional description. A folder used in `assets.csv` but missing here is
added at the end. Folders with nothing in them are not shown.

In Excel, save as **CSV UTF-8 (Comma delimited)**. Plain "CSV" turns ™ and ®
into question marks.

To check your edits before committing:

```bash
python3 tools/build_catalog.py --check
```

An `ERROR` (duplicate ID, missing title, bad URL) stops publishing until it is
fixed. A `warning` (a title that looks like a file name, `(TM)` instead of ™)
is only a suggestion.

### Preview images

PDFs show `thumbs/<ID>.jpg` if that file exists, otherwise an icon. To give a
new PDF a preview, save a JPEG of its first page under that name. This is a
manual step because 3M's file server refuses downloads from automated servers.

### Hidden assets

171 rows are marked `hidden`. An earlier automated link check removed them in
July 2026 for responding slowly, and they have not been re-checked. Set
`Status` to `live` to bring one back.

## Publishing

Every push to `main` runs `.github/workflows/site.yml`, which checks the
spreadsheets and the code, builds the web version and `catalog.json`, and
publishes them to the `gh-pages` branch (served by GitHub Pages).

The phone apps start from a catalog bundled inside them, then download the
published one, so they also work offline.

## Working on the app

```bash
cd app
npm install
npm run web         # run in a browser
npm run typecheck
npm test
```

After editing a spreadsheet, run `python3 tools/build_catalog.py` to refresh
the catalog bundled in the app (`app/assets/catalog.json`).

iPhone and Android builds are not set up yet. They need Expo's build service
(EAS) and Apple and Google developer accounts.

## Renaming

Change the name in three places: `APP_NAME` in `app/src/lib/config.ts`;
`name`, `slug` and `scheme` in `app/app.json`; and the title of this file.

If the website address changes, update `CONTENT_BASE_URL` in
`app/src/lib/config.ts` and `experiments.baseUrl` in `app/app.json`.

## Not included yet

- COSMO Pro (PIN-gated premium content).
- App Store and Google Play builds.
