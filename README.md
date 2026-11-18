# CSD Content Hub

A phone, tablet and web app for browsing 3M Commercial Solutions literature and
videos. It shows the whole library on one page, styled after the CBTD Technical
Document Library: categories in a black sidebar (a menu on phones), search,
Newest / A–Z sorting, and a type badge and date on every item. Tapping a title
opens the file; the star saves it to a Saved list, and the share button sends
the link. It is a separate project from the existing 3M™ COSMO app; "CSD Content
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
| Document Type | Optional free text shown as the badge, e.g. `Product Bulletin`. Anything containing "instruction" shows red, "warranty" outlined. Blank shows the Type. |
| URL | Required, must start with `https://`. For videos, the player link. |
| Folders | Where it appears. Levels are separated by ` > `, and several folders by `;`. Example: `Products > Films; Training` |
| Literature Number, Size (bytes), Created | Optional details shown on the item's page. |
| YouTube ID | Optional. Gives a video a preview image. |
| Status | `live` (default) or `hidden`. Hidden rows stay in the spreadsheet but not in the app. |
| Notes | For you. Never shown in the app. |

**`content/folders.csv`** lists the folders in the order they should appear,
with an optional description. A folder used in `assets.csv` but missing here is
added at the end. Folders with nothing in them are not shown.

How folders appear: top-level folders are the red headings in the sidebar, the
folders directly under them are the sidebar entries (sections), and any deeper
folders become grey sub-headings inside a section.

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

`thumbs/` holds first-page previews named `<ID>.jpg`. The current layout does
not show them; they are kept for later use.

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

Change the name, the red badge text and the small print in
`app/src/lib/config.ts`. The name also appears in `name`, `slug` and `scheme` in `app/app.json`, and in the title of this file.

If the website address changes, update `CONTENT_BASE_URL` in
`app/src/lib/config.ts` and `experiments.baseUrl` in `app/app.json`.

## Not included yet

- COSMO Pro (PIN-gated premium content).
- App Store and Google Play builds.
