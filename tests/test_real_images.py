"""Tests som bruker reelle kamerabilder.

Krever at testbilder er lastet ned:
    make download-test-images

Kjør med:
    make test-all
    # eller:
    pytest --real-images
"""

import pytest

JPEG_EXTENSIONS = {".jpg", ".jpeg"}
RAW_EXTENSIONS = {".cr2", ".cr3", ".nef", ".arw", ".orf", ".rw2", ".dng", ".raf"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _images_in(directory, extensions):
    return sorted(p for p in directory.rglob("*") if p.suffix.lower() in extensions)


# ---------------------------------------------------------------------------
# JPEG-tester
# ---------------------------------------------------------------------------

@pytest.mark.real_images
@pytest.mark.asyncio
async def test_register_all_jpegs(client, real_image_dir):
    """Alle JPEG-filer skal registreres uten feil."""
    jpegs = _images_in(real_image_dir, JPEG_EXTENSIONS)
    assert jpegs, f"Ingen JPEG-filer funnet i {real_image_dir}"

    registered = []
    for path in jpegs:
        resp = await client.post("/images/register", json={"file_path": str(path)})
        assert resp.status_code in (201, 409), (
            f"{path.name}: uventet statuskode {resp.status_code}\n{resp.text}"
        )
        if resp.status_code == 201:
            registered.append(resp.json())

    print(f"\n  Registrert {len(registered)}/{len(jpegs)} JPEG-filer (409 = duplikat fra tidligere kjøring)")


@pytest.mark.real_images
@pytest.mark.asyncio
async def test_jpeg_hotpreview_generated(client, real_image_dir):
    """Alle registrerte JPEG-filer skal ha en hotpreview."""
    jpegs = _images_in(real_image_dir, JPEG_EXTENSIONS)
    for path in jpegs:
        resp = await client.post("/images/register", json={"file_path": str(path)})
        if resp.status_code == 409:
            hothash = resp.json()["detail"]["hothash"]
        else:
            hothash = resp.json()["hothash"]

        detail = await client.get(f"/images/{hothash}")
        assert detail.status_code == 200
        data = detail.json()
        assert data["hotpreview_b64"], f"{path.name}: tom hotpreview"
        assert len(data["hotpreview_b64"]) > 100, f"{path.name}: hotpreview for liten"


@pytest.mark.real_images
@pytest.mark.asyncio
async def test_jpeg_exif_extracted(client, real_image_dir):
    """JPEG-filer med EXIF skal ha utfylte exif_data og taken_at."""
    jpegs = _images_in(real_image_dir / "jpeg", JPEG_EXTENSIONS) if (real_image_dir / "jpeg").exists() \
        else _images_in(real_image_dir, JPEG_EXTENSIONS)

    with_exif = 0
    with_taken_at = 0

    for path in jpegs:
        resp = await client.post("/images/register", json={"file_path": str(path)})
        if resp.status_code == 409:
            hothash = resp.json()["detail"]["hothash"]
        else:
            hothash = resp.json()["hothash"]

        data = (await client.get(f"/images/{hothash}")).json()

        if data["exif_data"]:
            with_exif += 1
        if data["taken_at"]:
            with_taken_at += 1

    total = len(jpegs)
    print(f"\n  {with_exif}/{total} bilder har EXIF")
    print(f"  {with_taken_at}/{total} bilder har taken_at")
    assert with_exif > 0, "Ingen JPEG-filer hadde EXIF — sjekk at bildene er fra et kamera"


@pytest.mark.real_images
@pytest.mark.asyncio
async def test_jpeg_coldpreview_on_disk(client, real_image_dir):
    """Coldpreview-filer skal eksistere på disk etter registrering."""
    jpegs = _images_in(real_image_dir, JPEG_EXTENSIONS)
    for path in jpegs[:5]:  # Sjekk de første 5
        resp = await client.post("/images/register", json={"file_path": str(path)})
        if resp.status_code == 409:
            hothash = resp.json()["detail"]["hothash"]
        else:
            hothash = resp.json()["hothash"]

        cp_resp = await client.get(f"/images/{hothash}/coldpreview")
        assert cp_resp.status_code == 200, f"{path.name}: coldpreview ikke tilgjengelig"
        assert cp_resp.headers["content-type"] == "image/jpeg"


# ---------------------------------------------------------------------------
# RAW-tester
# ---------------------------------------------------------------------------

@pytest.mark.real_images
@pytest.mark.asyncio
async def test_raw_files_handled(client, real_image_dir):
    """RAW-filer skal enten registreres (hvis Pillow støtter formatet) eller gi 422."""
    raws = _images_in(real_image_dir, RAW_EXTENSIONS)
    if not raws:
        pytest.skip("Ingen RAW-filer i .test-images/")

    supported = []
    unsupported = []

    for path in raws:
        resp = await client.post("/images/register", json={"file_path": str(path)})
        assert resp.status_code in (201, 409, 422), (
            f"{path.name}: uventet statuskode {resp.status_code}"
        )
        if resp.status_code in (201, 409):
            supported.append(path.name)
        else:
            unsupported.append(path.name)

    print(f"\n  RAW støttet av Pillow: {supported}")
    print(f"  RAW ikke støttet:      {unsupported}")


# ---------------------------------------------------------------------------
# Duplikat-deteksjon på tvers av filer
# ---------------------------------------------------------------------------

@pytest.mark.real_images
@pytest.mark.asyncio
async def test_no_false_duplicates(client, real_image_dir):
    """Ulike bilder fra ulike kameraer skal ikke kollidere på hothash."""
    jpegs = _images_in(real_image_dir, JPEG_EXTENSIONS)
    if len(jpegs) < 2:
        pytest.skip("Trenger minst 2 JPEG-filer for duplikattest")

    hashes = set()
    for path in jpegs:
        resp = await client.post("/images/register", json={"file_path": str(path)})
        if resp.status_code == 201:
            hashes.add(resp.json()["hothash"])

    # Alle nye registreringer skal ha unike hashes
    assert len(hashes) == len({p for p in jpegs if True}), \
        "Falskt duplikat oppdaget — ulike bilder fikk samme hothash"
