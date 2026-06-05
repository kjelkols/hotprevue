"""Teknisk bildekvalitet — beregnet ved registrering fra originalfilen."""

import io
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

from utils.registration import RAW_EXTENSIONS


def _is_raw(file_path: str) -> bool:
    return Path(file_path).suffix.lower() in RAW_EXTENSIONS


def _open_original(file_path: str) -> Image.Image:
    """Åpne originalfil som RGB PIL Image.

    RAW-filer: bruker innebygd JPEG-thumbnail (rask, tilstrekkelig kvalitet
    for metrikker). Faller tilbake til full LibRaw-dekoding ved behov.
    """
    if _is_raw(file_path):
        import rawpy

        with rawpy.imread(file_path) as raw:
            try:
                thumb = raw.extract_thumb()
                if thumb.format == rawpy.ThumbFormat.JPEG:
                    return Image.open(io.BytesIO(thumb.data)).convert("RGB")
            except Exception:
                pass
            rgb = raw.postprocess(use_camera_wb=True, output_bps=8)
        return Image.fromarray(rgb).convert("RGB")
    else:
        from PIL import ImageOps

        with Image.open(file_path) as f:
            return ImageOps.exif_transpose(f).convert("RGB").copy()


def compute_quality_metrics(file_path: str) -> dict[str, float | None]:
    """Beregn skarphet, eksponering og støy fra originalen.

    Returnerer dict med nøklene sharpness_score, exposure_mean,
    exposure_clipping og noise_score. Verdiene er float eller None ved feil.
    """
    try:
        img = _open_original(file_path)
    except Exception:
        return {"sharpness_score": None, "exposure_mean": None,
                "exposure_clipping": None, "noise_score": None}

    try:
        noise_score = _noise(img)

        # Skaler ned til maks 1600px for skarphet og eksponering
        w, h = img.size
        if max(w, h) > 1600:
            scale = 1600 / max(w, h)
            img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

        gray = np.array(img.convert("L"), dtype=np.float32)

        sharpness_score = _laplacian_var(gray)
        exposure_mean = float(gray.mean())
        exposure_clipping = float(((gray < 5).sum() + (gray > 250).sum()) / gray.size)

        return {
            "sharpness_score": sharpness_score,
            "exposure_mean": exposure_mean,
            "exposure_clipping": exposure_clipping,
            "noise_score": noise_score,
        }
    except Exception:
        return {"sharpness_score": None, "exposure_mean": None,
                "exposure_clipping": None, "noise_score": None}


def _laplacian_var(gray: np.ndarray) -> float:
    """Laplacian-varians som skarphetsmål. Høy verdi = skarp."""
    lap = (
        np.roll(gray, 1, axis=0) + np.roll(gray, -1, axis=0)
        + np.roll(gray, 1, axis=1) + np.roll(gray, -1, axis=1)
        - 4 * gray
    )
    return float(lap.var())


def _noise(img: Image.Image) -> float:
    """Støyestimering fra 512×512 senterutsnitt av originalen.

    Medianfilter-residualer isolerer støy fra bildetekstur.
    Bruker full oppløsning før eventuell nedskalering.
    """
    w, h = img.size
    pw, ph = min(512, w), min(512, h)
    cx, cy = w // 2, h // 2
    patch = img.crop((cx - pw // 2, cy - ph // 2, cx + pw // 2, cy + ph // 2))
    patch_gray = patch.convert("L")
    arr = np.array(patch_gray, dtype=np.float32)
    blurred = np.array(patch_gray.filter(ImageFilter.MedianFilter(5)), dtype=np.float32)
    return float((arr - blurred).std())
