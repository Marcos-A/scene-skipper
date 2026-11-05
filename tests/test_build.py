"""Check the packages users actually load, including browser-specific metadata."""

import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("build", ROOT / "scripts/build.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class PackageTests(unittest.TestCase):
    def test_browser_packages_share_assets_and_have_correct_manifests(self):
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp)
            manifests = {}
            for browser in builder.BROWSERS:
                with self.subTest(browser=browser):
                    directory, archive = builder.build(browser, output)
                    manifests[browser] = json.loads((directory / "manifest.json").read_text())
                    with ZipFile(archive) as package:
                        names = set(package.namelist())
                        expected = {"manifest.json", "content.js", "popup.js", "popup.html", "popup.css",
                                    "icons/16.png", "icons/32.png", "icons/48.png", "icons/128.png"}
                        self.assertEqual(names, expected)
                        for name in names:
                            self.assertEqual(package.read(name), (directory / name).read_bytes())
                            if name != "manifest.json":
                                self.assertEqual(package.read(name), (ROOT / name).read_bytes())
                    # A rebuild removes stale runtime files from this target only.
                    (directory / "stale.js").write_text("stale")
                    builder.build(browser, output)
                    self.assertFalse((directory / "stale.js").exists())

            chromium = manifests["chromium"]
            firefox = manifests["firefox"]
            self.assertNotIn("browser_specific_settings", chromium)
            gecko = firefox.pop("browser_specific_settings")["gecko"]
            self.assertEqual(gecko["data_collection_permissions"], {"required": ["none"]})
            self.assertEqual(gecko["strict_min_version"], "142.0")
            self.assertTrue(gecko["id"])
            self.assertEqual(firefox, chromium)
            self.assertTrue((output / "chromium/manifest.json").exists())

    def test_unknown_browser_is_rejected_before_writing(self):
        with self.assertRaises(ValueError):
            builder.build("unknown")


if __name__ == "__main__":
    unittest.main()
