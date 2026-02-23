#!/usr/bin/env python3
"""Download test images from a GitHub Release and extract to .test-images/.

Usage:
    python scripts/download-test-images.py
    python scripts/download-test-images.py --tag test-assets-v2
    python scripts/download-test-images.py --force   # re-download even if cached

The release must exist at:
    https://github.com/kjelkols/hotprevue/releases/tag/<tag>

with an asset named "test-images.tar.gz".

To create the release and upload images:
    gh release create test-assets-v1 --title "Test assets v1" --notes "Camera test images"
    gh release upload test-assets-v1 test-images.tar.gz
"""

import argparse
import shutil
import subprocess
import sys
import tarfile
import urllib.request
from pathlib import Path

REPO = "kjelkols/hotprevue"
ASSET_NAME = "test-images.tar.gz"
DEFAULT_TAG = "test-assets-v1"
DEST = Path(__file__).parent.parent / ".test-images"


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--tag", default=DEFAULT_TAG, help=f"Release tag (default: {DEFAULT_TAG})")
    parser.add_argument("--force", action="store_true", help="Re-download even if .test-images/ already exists")
    args = parser.parse_args()

    if DEST.exists() and any(DEST.iterdir()) and not args.force:
        print(f"✓ {DEST} already exists. Use --force to re-download.")
        return

    archive = DEST.parent / ASSET_NAME

    # Prefer gh CLI (authenticated, no rate limits)
    if shutil.which("gh"):
        print(f"Laster ned {ASSET_NAME} fra release {args.tag} via gh CLI...")
        subprocess.run(
            ["gh", "release", "download", args.tag,
             "--repo", REPO,
             "--pattern", ASSET_NAME,
             "--output", str(archive),
             "--clobber"],
            check=True,
        )
    else:
        url = f"https://github.com/{REPO}/releases/download/{args.tag}/{ASSET_NAME}"
        print(f"Laster ned {url} ...")
        urllib.request.urlretrieve(url, archive, reporthook=_progress)
        print()

    print(f"Pakker ut til {DEST} ...")
    DEST.mkdir(exist_ok=True)
    with tarfile.open(archive) as tf:
        tf.extractall(DEST)

    archive.unlink()
    count = sum(1 for _ in DEST.rglob("*") if _.is_file())
    print(f"✓ {count} filer tilgjengelig i {DEST}")


def _progress(block_num, block_size, total_size):
    downloaded = block_num * block_size
    if total_size > 0:
        pct = min(downloaded / total_size * 100, 100)
        bar = "█" * int(pct / 2) + "░" * (50 - int(pct / 2))
        print(f"\r  [{bar}] {pct:.0f}%", end="", flush=True)


if __name__ == "__main__":
    main()
