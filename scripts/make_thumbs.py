#!/usr/bin/env python3
"""Generate first-page thumbnails for every PDF asset in js/data.js.

Downloads each PDF (needs an environment where multimedia.3m.com is
reachable — a laptop or a GitHub Actions runner), renders page 1 to a small
JPEG in thumbs/<asset id>.jpg, and writes thumbs/manifest.json listing the
asset ids that have a thumbnail. The app only requests thumbnails for ids in
the manifest, so a partial run is fine — rerun to fill in the rest (existing
thumbnails are skipped).

Usage:
    pip install requests pypdfium2 pillow
    python3 scripts/make_thumbs.py [--limit N]
"""
import io
import json
import sys
import time
from pathlib import Path

import requests

try:
    import pypdfium2 as pdfium
    from PIL import Image
except ImportError:
    sys.exit("pip install requests pypdfium2 pillow")

ROOT = Path(__file__).resolve().parent.parent
THUMB_DIR = ROOT / "thumbs"
WIDTH = 288          # 2x the 72px-wide row thumbnail wells shown in the app
TIMEOUT = 20
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")


def load_assets():
    raw = (ROOT / "js" / "data.js").read_text(encoding="utf-8")
    data = json.loads(raw.split("window.CSD_DATA = ", 1)[1].rstrip().rstrip(";"))
    return data["assets"]


def render_thumb(pdf_bytes, out_path):
    doc = pdfium.PdfDocument(pdf_bytes)
    try:
        page = doc[0]
        scale = WIDTH / page.get_size()[0]
        bitmap = page.render(scale=scale)
        img = bitmap.to_pil().convert("RGB")
        img.save(out_path, "JPEG", quality=72, optimize=True)
    finally:
        doc.close()


def main():
    limit = None
    if "--limit" in sys.argv:
        limit = int(sys.argv[sys.argv.index("--limit") + 1])

    assets = load_assets()
    pdfs = [a for a in assets.values()
            if a.get("type") == "application/pdf" and a.get("url")]
    THUMB_DIR.mkdir(exist_ok=True)

    done = failed = skipped = 0
    for a in pdfs:
        out = THUMB_DIR / (a["id"] + ".jpg")
        if out.exists():
            skipped += 1
            continue
        if limit is not None and done >= limit:
            break
        try:
            # requests' timeout is per-read, not total: a server that trickles
            # bytes can hang a plain get() indefinitely. Stream with a hard
            # total deadline instead.
            buf = io.BytesIO()
            deadline = time.monotonic() + 60
            with requests.get(a["url"], timeout=TIMEOUT, stream=True,
                              headers={"User-Agent": UA}) as r:
                r.raise_for_status()
                for chunk in r.iter_content(65536):
                    buf.write(chunk)
                    if time.monotonic() > deadline:
                        raise TimeoutError("total download exceeded 60s")
            render_thumb(buf.getvalue(), out)
            done += 1
            if done % 25 == 0:
                print(f"  {done} rendered...")
        except Exception as e:
            failed += 1
            print(f"  FAILED {a['id']}: {type(e).__name__}: {e}")

    ids = sorted(p.stem for p in THUMB_DIR.glob("*.jpg"))
    (THUMB_DIR / "manifest.json").write_text(json.dumps(ids), encoding="utf-8")
    print(f"Rendered {done}, skipped {skipped} existing, failed {failed}. "
          f"Manifest lists {len(ids)} thumbnails.")


if __name__ == "__main__":
    main()
