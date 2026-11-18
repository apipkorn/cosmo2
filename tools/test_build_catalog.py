"""Tests for build_catalog.py. Run: python3 -m unittest discover tools"""
import tempfile
import unittest
from pathlib import Path

from build_catalog import ROOT, build, editions

ASSET_HEAD = ("ID,Title,Description,Type,Document Type,URL,Folders,Literature Number,"
              "Size (bytes),Created,YouTube ID,Status,Notes\n")


def run(assets, folders="Folder,Description\nFilms,\n"):
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        (tmp / "assets.csv").write_text(ASSET_HEAD + assets, encoding="utf-8")
        (tmp / "folders.csv").write_text(folders, encoding="utf-8")
        return build(tmp / "assets.csv", tmp / "folders.csv", tmp / "thumbs")


class BuildCatalogTests(unittest.TestCase):
    def test_basic_asset_lands_in_its_folder(self):
        cat, errors, warnings, stats = run(
            "1,Wrap Film,About film,PDF,Product Bulletin,https://x.test/a.pdf,Films,75-1,2048,2024-01-02,,live,\n")
        self.assertEqual((errors, warnings), ([], []))
        self.assertEqual(cat["assets"][0], {
            "id": "1", "title": "Wrap Film", "kind": "pdf", "url": "https://x.test/a.pdf",
            "docType": "Product Bulletin", "description": "About film", "lit": "75-1",
            "created": "2024-01-02", "size": 2048})
        self.assertEqual(cat["folders"][0]["assetIds"], ["1"])

    def test_hidden_assets_are_left_out(self):
        cat, errors, _, stats = run(
            "1,A,,PDF,,https://x.test/a.pdf,Films,,,,,hidden,\n"
            "2,B,,PDF,,https://x.test/b.pdf,Films,,,,,,\n")
        self.assertEqual(errors, [])
        self.assertEqual([a["id"] for a in cat["assets"]], ["2"])
        self.assertEqual(stats["hidden"], 1)

    def test_errors_for_duplicate_id_bad_url_and_missing_title(self):
        _, errors, _, _ = run(
            "1,A,,PDF,,https://x.test/a.pdf,Films,,,,,live,\n"
            "1,B,,PDF,,https://x.test/b.pdf,Films,,,,,live,\n"
            "2,,,PDF,,http://x.test/c.pdf,Films,,,,,live,\n"
            "3,D,,Spreadsheet,,https://x.test/d,Films,,,,,live,\n"
            "4,E,,PDF,,https://x.test/e.pdf,Films,,,,,gone,\n")
        text = "\n".join(errors)
        for expected in ("same ID as row 2", "Title is empty", "must start with https://",
                         "Type 'Spreadsheet'", "Status must be"):
            self.assertIn(expected, text)

    def test_warnings_for_sloppy_titles_and_unfiled_assets(self):
        _, errors, warnings, _ = run(
            "1,Cutting Techniques.mp4,,Video,,https://x.test/v,Films,,,,,live,\n"
            "2,Scotch-Brite(TM) Pad,,PDF,,https://x.test/b.pdf,,,,,,live,\n")
        self.assertEqual(errors, [])
        text = "\n".join(warnings)
        self.assertIn("looks like a file name", text)
        self.assertIn("(TM)", text)
        self.assertIn("not in any folder", text)

    def test_nested_and_unlisted_folders(self):
        cat, errors, warnings, _ = run(
            "1,A,,PDF,,https://x.test/a.pdf,Films > Wrap; Cleaning,,,,,live,\n")
        self.assertEqual(errors, [])
        by_name = {f["name"]: f for f in cat["folders"]}
        self.assertEqual(by_name["Wrap"]["parent"], by_name["Films"]["id"])
        self.assertEqual(by_name["Wrap"]["assetIds"], ["1"])
        self.assertEqual(by_name["Cleaning"]["assetIds"], ["1"])
        self.assertEqual(len(warnings), 2)  # both folders missing from folders.csv

    def test_kind_is_guessed_when_type_is_blank_and_youtube_gives_a_thumbnail(self):
        cat, _, _, _ = run(
            "1,A,,,,https://players.brightcove.net/1/x/index.html?videoId=2,Films,,,,abc123,live,\n")
        self.assertEqual(cat["assets"][0]["kind"], "video")
        self.assertEqual(cat["assets"][0]["thumb"], "https://i.ytimg.com/vi/abc123/hqdefault.jpg")

    def test_version_changes_only_when_content_changes(self):
        row = "1,A,,PDF,,https://x.test/a.pdf,Films,,,,,live,\n"
        self.assertEqual(run(row)[0]["version"], run(row)[0]["version"])
        self.assertNotEqual(run(row)[0]["version"], run(row.replace(",A,", ",B,"))[0]["version"])

    def test_every_edition_has_spreadsheets_without_errors(self):
        for name in editions():
            with self.subTest(edition=name):
                content = ROOT / "content" / name
                _, errors, _, stats = build(
                    content / "assets.csv", content / "folders.csv", ROOT / "thumbs")
                self.assertEqual(errors, [])
                self.assertGreater(stats["assets"], 0)


if __name__ == "__main__":
    unittest.main()
