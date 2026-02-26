#!/usr/bin/env python3
"""Last ned testbilder fra GitHub Release til .test-images/.

Bruk:
    python scripts/download-test-images.py           # lite sett (standard)
    python scripts/download-test-images.py --full    # fullt sett (~350 MB)
    python scripts/download-test-images.py --force   # last ned på nytt selv om cache finnes

Release: https://github.com/kjelkols/hotprevue/releases/tag/test-assets-v1
"""

import argparse
import subprocess
import tarfile
from pathlib import Path

REPO = "kjelkols/hotprevue"
TAG = "test-assets-v1"
ASSET_SMALL = "test-images-small.tar.gz"
ASSET_FULL = "test-images.tar.gz"
DEST = Path(__file__).parent.parent / ".test-images"


def main():
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--full", action="store_true", help="Last ned fullt sett (~350 MB)")
    parser.add_argument("--force", action="store_true", help="Last ned på nytt selv om cache finnes")
    args = parser.parse_args()

    asset = ASSET_FULL if args.full else ASSET_SMALL

    if DEST.exists() and any(DEST.iterdir()) and not args.force:
        count = sum(1 for p in DEST.rglob("*") if p.is_file())
        print(f"✓ .test-images/ finnes allerede ({count} filer). Bruk --force for å laste ned på nytt.")
        return

    archive = DEST.parent / asset

    print(f"Laster ned {asset} fra release {TAG}...")
    subprocess.run(
        [
            "gh", "release", "download", TAG,
            "--repo", REPO,
            "--pattern", asset,
            "--output", str(archive),
            "--clobber",
        ],
        check=True,
    )

    DEST.mkdir(exist_ok=True)
    print(f"Pakker ut til {DEST}...")
    with tarfile.open(archive) as tf:
        tf.extractall(DEST)

    archive.unlink()
    count = sum(1 for p in DEST.rglob("*") if p.is_file())
    print(f"✓ {count} filer tilgjengelig i .test-images/")


if __name__ == "__main__":
    main()
