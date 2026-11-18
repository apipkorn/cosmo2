#!/usr/bin/env python3
"""Turn the content spreadsheets into the catalogs the apps read.

    python3 tools/build_catalog.py                  # check + write every edition
    python3 tools/build_catalog.py --check          # check only, write nothing
    python3 tools/build_catalog.py -e transportation   # one edition only

Each edition listed in app/editions.json has its own folder of spreadsheets:

Inputs   content/<edition>/assets.csv   one row per asset
         content/<edition>/folders.csv  one row per folder, in display order
Outputs  app/assets/catalogs/<edition>.json   snapshot bundled inside the app
         <--out>/<webPath>/catalog.json       copy published to the website (optional)

Problems that would break the app stop the build ("ERROR"). Things that only
look wrong are listed as "warning" and the build carries on. Uses only the
Python standard library.
"""
import argparse
import csv
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEP = " > "  # between folder levels, e.g. "Products > Films"

# Spreadsheet "Type" -> the kind the app uses for icons and filters.
KINDS = {
    "pdf": "pdf",
    "video": "video",
    "image": "image",
    "presentation": "doc",
    "document": "doc",
    "archive": "file",
    "link": "link",
}
STATUSES = {"live", "hidden"}
FILE_SUFFIX = re.compile(r"\.(pdf|mp4|mov|docx?|pptx?|zip|jpe?g|png)$", re.I)


def read_csv(path):
    """Rows as dicts, values stripped. Row numbers match the spreadsheet."""
    with open(path, newline="", encoding="utf-8-sig") as f:
        rows = []
        for n, row in enumerate(csv.DictReader(f), start=2):
            clean = {(k or "").strip(): (v or "").strip() for k, v in row.items()}
            if any(clean.values()):
                rows.append((n, clean))
        return rows


def slugify(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def guess_kind(url):
    low = url.lower().split("?")[0]
    if low.endswith(".pdf"):
        return "pdf"
    if "brightcove" in low or "youtube.com" in low or "youtu.be" in low:
        return "video"
    if re.search(r"\.(jpe?g|png|gif)$", low):
        return "image"
    return "link"


def split_path(text):
    return [p.strip() for p in text.split(">") if p.strip()]


def build(assets_csv, folders_csv, thumbs_dir):
    """Returns (catalog, errors, warnings)."""
    errors, warnings = [], []

    # ---- folders, in spreadsheet order -------------------------------------
    folders = {}  # path tuple -> folder record

    def add_folder(path, description=""):
        """Adds a folder and any missing parents; returns its id."""
        path = tuple(path)
        if path in folders:
            if description:
                folders[path]["description"] = description
            return folders[path]["id"]
        parent = add_folder(path[:-1]) if len(path) > 1 else None
        base = slugify("--".join(path)) or "folder"
        fid, n = base, 2
        taken = {f["id"] for f in folders.values()}
        while fid in taken:
            fid, n = f"{base}-{n}", n + 1
        folders[path] = {
            "id": fid, "name": path[-1], "parent": parent,
            "description": description, "assetIds": [],
        }
        return fid

    for n, row in read_csv(folders_csv):
        path = split_path(row.get("Folder", ""))
        if not path:
            errors.append(f"folders.csv row {n}: Folder is empty")
            continue
        add_folder(path, row.get("Description", ""))

    # ---- assets ------------------------------------------------------------
    assets, seen, hidden = [], {}, 0
    for n, row in read_csv(assets_csv):
        where = f"assets.csv row {n}"
        aid, title, url = row.get("ID", ""), row.get("Title", ""), row.get("URL", "")
        status = (row.get("Status", "") or "live").lower()

        if not aid:
            errors.append(f"{where}: ID is empty")
            continue
        where = f"{where} (ID {aid})"
        if aid in seen:
            errors.append(f"{where}: same ID as row {seen[aid]}")
            continue
        seen[aid] = n
        if status not in STATUSES:
            errors.append(f"{where}: Status must be 'live' or 'hidden', not '{status}'")
            continue
        if status == "hidden":
            hidden += 1
            continue
        if not title:
            errors.append(f"{where}: Title is empty")
        if not url.startswith("https://"):
            errors.append(f"{where}: URL must start with https://")

        type_text = row.get("Type", "").lower()
        if type_text and type_text not in KINDS:
            errors.append(f"{where}: Type '{row['Type']}' is not one of "
                          + ", ".join(k.title() for k in KINDS))
        kind = KINDS.get(type_text) or guess_kind(url)

        if FILE_SUFFIX.search(title):
            warnings.append(f"{where}: title looks like a file name: {title}")
        if "(TM)" in title or "(R)" in title:
            warnings.append(f"{where}: title uses (TM)/(R) instead of ™/®: {title}")

        asset = {"id": aid, "title": title, "kind": kind, "url": url}
        if row.get("Document Type"):
            asset["docType"] = row["Document Type"]
        if row.get("Description"):
            asset["description"] = row["Description"]
        if row.get("Literature Number"):
            asset["lit"] = row["Literature Number"]
        if row.get("Created"):
            asset["created"] = row["Created"]
        size = row.get("Size (bytes)", "")
        if size:
            if size.isdigit():
                asset["size"] = int(size)
            else:
                warnings.append(f"{where}: Size (bytes) is not a whole number: {size}")
        if (thumbs_dir / f"{aid}.jpg").exists():
            asset["thumb"] = f"thumbs/{aid}.jpg"
        elif row.get("YouTube ID"):
            asset["thumb"] = f"https://i.ytimg.com/vi/{row['YouTube ID']}/hqdefault.jpg"

        placed = [split_path(p) for p in row.get("Folders", "").split(";")]
        placed = [p for p in placed if p]
        if not placed:
            warnings.append(f"{where}: not in any folder, so it only shows up in search")
        for path in placed:
            if tuple(path) not in folders:
                warnings.append(f"{where}: folder '{SEP.join(path)}' is not in "
                                "folders.csv; added at the end")
            add_folder(path)
            folders[tuple(path)]["assetIds"].append(aid)
        assets.append(asset)

    body = {"folders": list(folders.values()), "assets": assets}
    digest = hashlib.sha256(
        json.dumps(body, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    catalog = {"version": digest[:12], **body}
    stats = {"folders": len(folders), "assets": len(assets), "hidden": hidden}
    return catalog, errors, warnings, stats


def editions():
    """Edition name -> settings, from app/editions.json."""
    return json.loads((ROOT / "app" / "editions.json").read_text(encoding="utf-8"))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--check", action="store_true", help="check only, write nothing")
    ap.add_argument("--out", type=Path, help="also write each catalog.json under this folder")
    ap.add_argument("-e", "--edition", action="append", help="only this edition (repeatable)")
    args = ap.parse_args()

    known = editions()
    chosen = args.edition or list(known)
    unknown = [e for e in chosen if e not in known]
    if unknown:
        sys.exit(f"Unknown edition {unknown}; app/editions.json has {list(known)}")

    failed = False
    for name in chosen:
        content = ROOT / "content" / name
        print(f"== {name} ({known[name]['name']})")
        catalog, errors, warnings, stats = build(
            content / "assets.csv", content / "folders.csv", ROOT / "thumbs")
        for w in warnings:
            print("warning:", w)
        for e in errors:
            print("ERROR:", e)
        print(f"{stats['assets']} live assets, {stats['hidden']} hidden, "
              f"{stats['folders']} folders, {len(warnings)} warnings, {len(errors)} errors\n")
        if errors:
            failed = True
            continue
        if args.check:
            continue
        text = json.dumps(catalog, ensure_ascii=False, separators=(",", ":"))
        targets = [ROOT / "app" / "assets" / "catalogs" / f"{name}.json"]
        if args.out:
            targets.append(args.out / known[name]["webPath"] / "catalog.json")
        for target in targets:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(text + "\n", encoding="utf-8")
            print("wrote", target)
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
