import type { CSSProperties } from 'react'

export interface CorrectionInput {
  rotation?: number | null
  flip_horizontal?: boolean | null
  crop_left?: number | null
  crop_top?: number | null
  crop_right?: number | null
  crop_bottom?: number | null
  exposure_ev?: number | null
}

export interface PhotoTransformCSS {
  imgStyle: CSSProperties
  wrapperStyle: CSSProperties
}

/**
 * Computes CSS properties that mirror the backend serve_coldpreview() pipeline:
 *   1. rotation (rotate(Ndeg) — left-to-right CSS = rotate first)
 *   2. flip_horizontal (scaleX(-1) — applied after rotation)
 *   3. crop → clip-path on wrapper (container coord system = post-rotation visual space)
 *   4. exposure_ev → filter: brightness(2^ev) on img
 *
 * Horizon correction is not represented (too subtle at thumbnail size, requires
 * the auto-crop step that cannot be replicated in CSS).
 *
 * Works correctly for square thumbnails (150×150). For square sources, rotating
 * does not change the container dimensions, so the wrapper's clip-path coordinate
 * system always corresponds to the post-rotation visual space.
 */
export function computePhotoTransformCSS(c: CorrectionInput | null | undefined): PhotoTransformCSS {
  if (!c) return { imgStyle: {}, wrapperStyle: {} }

  const transforms: string[] = []
  if (c.rotation) transforms.push(`rotate(${c.rotation}deg)`)
  if (c.flip_horizontal) transforms.push('scaleX(-1)')

  const cl = (c.crop_left ?? 0) * 100
  const ct = (c.crop_top ?? 0) * 100
  const cr = (c.crop_right ?? 0) * 100
  const cb = (c.crop_bottom ?? 0) * 100
  const hasCrop = cl + ct + cr + cb > 0

  const ev = c.exposure_ev ?? 0

  return {
    imgStyle: {
      ...(transforms.length ? { transform: transforms.join(' ') } : {}),
      ...(ev ? { filter: `brightness(${Math.pow(2, ev).toFixed(3)})` } : {}),
    },
    wrapperStyle: {
      ...(hasCrop ? { clipPath: `inset(${ct}% ${cr}% ${cb}% ${cl}%)` } : {}),
    },
  }
}
