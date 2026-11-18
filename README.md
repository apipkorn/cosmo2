# 3M Content Hubs

Two phone, tablet and web apps built from one project:

| Edition | App name | Website | Content |
|---|---|---|---|
| `graphics` | Commercial & Graphics Content Hub | https://apipkorn.github.io/cosmo2/ | `content/graphics/` |
| `transportation` | Transportation Safety Content Hub | https://apipkorn.github.io/cosmo2/transportation/ | `content/transportation/` |

Each app browses 3M literature and videos for its business. It shows the whole library on one page, styled after the CBTD Technical
Document Library: categories in a black sidebar (a menu on phones), search,
Newest / A–Z sorting, and a type badge and date on every item. Tapping a title
opens the file; the star saves it to a Saved list, and the share button sends
the link. Both are separate from the existing 3M™ COSMO app.

All content comes from spreadsheets in this repository, two per edition.
Change a spreadsheet, and that app picks up the change the next time it opens. No app
release is needed and there is no server to look after.

```
content/   the spreadsheets you edit: content/graphics/ and content/transportation/
tools/     turns the spreadsheets into catalog.json files, and checks them
app/       the app itself (Expo / React Native, TypeScript); app/editions.json
           holds each edition's name and texts
thumbs/    preview images, named <asset ID>.jpg
```

## Changing content

Edit the files in `content/graphics/` or `content/transportation/` and commit
the change to `main`. Both folders hold the same two files.

**`assets.csv`** has one row per PDF, video or other item.

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

**`folders.csv`** lists the folders in the order they should appear,
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

An item can be in both editions: add a row to each spreadsheet. Four
reflective-sheeting bulletins (3930, 4000, 3430 and 1170) are in both today,
as they are in the CBTD Technical Document Library.

### Where the content came from

- **Graphics:** the CSD US spreadsheets from the earlier version of this
  project. Dates are when each item was first added.
- **Transportation:** the Transportation Safety part of the CBTD Technical
  Document Library (June 2026). Dates are when 3M last updated each file.

### Hidden assets

171 graphics rows are marked `hidden`. An earlier automated link check removed them in
July 2026 for responding slowly, and they have not been re-checked. Set
`Status` to `live` to bring one back.

## Publishing

Every push to `main` runs `.github/workflows/site.yml`, which checks the
spreadsheets and the code, builds both editions' websites and catalogs, and
publishes them to the `gh-pages` branch (served by GitHub Pages).

The phone apps start from a catalog bundled inside them, then download the
published one, so they also work offline.

## Working on the app

```bash
cd app
npm install
npm run web                  # Commercial & Graphics, in a browser
npm run web:transportation   # Transportation Safety, in a browser
npm run typecheck
npm test
```

The edition is chosen when the app is built, with the `EXPO_PUBLIC_EDITION`
environment variable (`graphics` if unset); the `:transportation` scripts set
it for you. After editing a spreadsheet, run `python3 tools/build_catalog.py` to
refresh the catalogs bundled in the apps (`app/assets/catalogs/`).

iPhone and Android builds are not set up yet. They need Expo's build service
(EAS) and Apple and Google developer accounts. Each edition will need its own
app ID (for example `com.3m.cgcontenthub`), added in `app/app.config.ts`.

## Renaming or adding an edition

Names, sidebar text, banner text and search examples are in
`app/editions.json`. `webPath` is the folder of that edition's website under
`/cosmo2/`. The red badge text and the small print are in
`app/src/lib/config.ts`.

To add an edition: add an entry to `app/editions.json`, create
`content/<edition>/assets.csv` and `folders.csv`, and add its build step to
`.github/workflows/site.yml`.

## Not included yet

- COSMO Pro (PIN-gated premium content).
- App Store and Google Play builds.
