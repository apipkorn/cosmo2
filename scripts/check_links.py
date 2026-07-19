#!/usr/bin/env python3
"""Probe every asset link in js/data.js and write reports/link-report.json.

For each asset the effective link is playUrl (videos) or url. Each unique
link gets a GET with a 5-second budget and a browser-like User-Agent;
status, elapsed time and any error are recorded. Links are classified:

  ok       — HTTP < 400 within the time budget
  slow     — HTTP < 400 but response took longer than the budget
  broken   — HTTP >= 400
  error    — network failure (DNS, TLS, connection, timeout)

Run in an environment with open internet (GitHub Actions, a laptop) —
corporate proxies that block these hosts will skew every result.
"""
import json
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

TIMEOUT = 5.0
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

ROOT = Path(__file__).resolve().parent.parent


def load_assets():
    raw = (ROOT / "js" / "data.js").read_text(encoding="utf-8")
    data = json.loads(raw.split("window.CSD_DATA = ", 1)[1].rstrip().rstrip(";"))
    return data["assets"]


def probe(url):
    started = time.monotonic()
    try:
        with requests.get(url, timeout=TIMEOUT, stream=True, allow_redirects=True,
                          headers={"User-Agent": UA}) as r:
            elapsed = time.monotonic() - started
            status = r.status_code
        if status >= 400:
            verdict = "broken"
        elif elapsed > TIMEOUT:
            verdict = "slow"
        else:
            verdict = "ok"
        return {"status": status, "elapsedMs": round(elapsed * 1000), "verdict": verdict}
    except requests.exceptions.Timeout:
        return {"status": None, "elapsedMs": round((time.monotonic() - started) * 1000),
                "verdict": "slow", "error": "timeout > %.0fs" % TIMEOUT}
    except requests.exceptions.RequestException as e:
        return {"status": None, "elapsedMs": round((time.monotonic() - started) * 1000),
                "verdict": "error", "error": type(e).__name__}


def probe_all(urls, workers):
    results = {}
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(probe, url): url for url in urls}
        done = 0
        for fut in as_completed(futures):
            results[futures[fut]] = fut.result()
            done += 1
            if done % 50 == 0:
                print(f"  {done}/{len(urls)}")
    return results


def main():
    assets = load_assets()
    links = {}  # url -> [asset ids]
    for a in assets.values():
        link = a.get("playUrl") or a.get("url")
        if link:
            links.setdefault(link, []).append(a["id"])

    print(f"Probing {len(links)} unique links for {len(assets)} assets "
          f"(timeout {TIMEOUT:.0f}s)...")
    results = probe_all(links, workers=12)

    # The CDN throttles bursts from a single IP, which shows up as timeouts
    # at exactly the budget. Re-probe every non-ok link gently (2 workers,
    # after a pause) up to twice and keep the best result, so only links that
    # persistently fail or stay slow are reported as failures.
    for attempt in (2, 3):
        retry = [u for u, r in results.items() if r["verdict"] != "ok"]
        if not retry:
            break
        print(f"Retry pass {attempt}: {len(retry)} non-ok links at low concurrency...")
        time.sleep(10)
        for url, res in probe_all(retry, workers=2).items():
            res["attempts"] = attempt
            if res["verdict"] == "ok" or results[url]["verdict"] == "error":
                results[url] = res

    report = {
        "generated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "timeoutSeconds": TIMEOUT,
        "links": [
            dict(url=url, assetIds=links[url], **results[url])
            for url in sorted(links)
        ],
    }
    counts = {}
    stub = 0
    for row in report["links"]:
        counts[row["verdict"]] = counts.get(row["verdict"], 0) + 1
        if re.search(r"/media/\d+[A-Za-z]?$", row["url"]):
            stub += 1
    report["summary"] = counts

    out = ROOT / "reports" / "link-report.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(report, indent=1), encoding="utf-8")
    print("Summary:", counts, f"({stub} bare-stub URLs probed)")
    print("Wrote", out)


if __name__ == "__main__":
    main()
