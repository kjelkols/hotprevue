import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateCorrection, deleteCorrection, type CorrectionPatch } from '../../api/photos'
import type { PhotoDetail } from '../../types/api'
import CorrectionSliders from './CorrectionSliders'

interface Props {
  photo: PhotoDetail
  mode?: 'full' | 'compact'
}

const btn = 'px-2.5 py-1 rounded text-sm bg-gray-800 hover:bg-gray-700 text-gray-200 transition-colors'
const btnOn = 'px-2.5 py-1 rounded text-sm bg-blue-700 hover:bg-blue-600 text-white transition-colors'

export default function CorrectionPanel({ photo, mode = 'full' }: Props) {
  const qc = useQueryClient()
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [horizonAngle, setHorizonAngle] = useState(photo.correction?.horizon_angle ?? 0)
  const [exposureEv, setExposureEv] = useState(photo.correction?.exposure_ev ?? 0)
  const [cropLeft, setCropLeft] = useState(photo.correction?.crop_left ?? 0)
  const [cropTop, setCropTop] = useState(photo.correction?.crop_top ?? 0)
  const [cropRight, setCropRight] = useState(photo.correction?.crop_right ?? 0)
  const [cropBottom, setCropBottom] = useState(photo.correction?.crop_bottom ?? 0)

  useEffect(() => {
    setHorizonAngle(photo.correction?.horizon_angle ?? 0)
    setExposureEv(photo.correction?.exposure_ev ?? 0)
    setCropLeft(photo.correction?.crop_left ?? 0)
    setCropTop(photo.correction?.crop_top ?? 0)
    setCropRight(photo.correction?.crop_right ?? 0)
    setCropBottom(photo.correction?.crop_bottom ?? 0)
  }, [photo.hothash])

  function applyUpdate(updated: PhotoDetail) {
    qc.setQueryData<PhotoDetail>(['photo', photo.hothash], updated)
    qc.invalidateQueries({ queryKey: ['photos'] })
  }
  const updateMut = useMutation({
    mutationFn: (patch: CorrectionPatch) => updateCorrection(photo.hothash, patch),
    onSuccess: applyUpdate,
  })
  const deleteMut = useMutation({
    mutationFn: () => deleteCorrection(photo.hothash),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['photo', photo.hothash] })
      qc.invalidateQueries({ queryKey: ['photos'] })
    },
  })

  const rotation = photo.correction?.rotation ?? 0
  const flipH = photo.correction?.flip_horizontal ?? false

  const hasCrop = !!(
    photo.correction?.crop_left ||
    photo.correction?.crop_top ||
    photo.correction?.crop_right ||
    photo.correction?.crop_bottom
  )

  // Crop coordinates are stored in post-rotation space. Changing rotation or flip
  // invalidates them, so we clear them automatically with the same PATCH call.
  const cropReset = hasCrop
    ? { crop_left: null, crop_top: null, crop_right: null, crop_bottom: null }
    : {}

  function rotateCW() {
    const n = (rotation + 90) % 360
    setCropLeft(0); setCropTop(0); setCropRight(0); setCropBottom(0)
    updateMut.mutate({ rotation: n || null, ...cropReset })
  }
  function rotateCCW() {
    const n = ((rotation - 90) + 360) % 360
    setCropLeft(0); setCropTop(0); setCropRight(0); setCropBottom(0)
    updateMut.mutate({ rotation: n || null, ...cropReset })
  }
  function rotate180() {
    const n = (rotation + 180) % 360
    setCropLeft(0); setCropTop(0); setCropRight(0); setCropBottom(0)
    updateMut.mutate({ rotation: n || null, ...cropReset })
  }

  function autoEnhance() {
    if (photo.exposure_mean == null) return
    let ev = -((photo.exposure_mean - 128) / 128) * 1.2
    ev = Math.max(-1.5, Math.min(1.5, ev))
    if ((photo.exposure_clipping ?? 0) > 0.05) ev *= 0.8
    updateMut.mutate({ exposure_ev: Math.round(ev * 10) / 10 })
  }

  function deb(patch: CorrectionPatch) {
    if (debRef.current) clearTimeout(debRef.current)
    debRef.current = setTimeout(() => updateMut.mutate(patch), 400)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Korreksjon</span>
        {photo.correction && (
          <button onClick={() => deleteMut.mutate()} disabled={deleteMut.isPending}
            className="text-xs text-gray-500 hover:text-red-400 transition-colors">
            Nullstill alt
          </button>
        )}
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        <button onClick={rotateCCW} title="Rotér mot klokken" className={btn}>↺</button>
        <button onClick={rotateCW} title="Rotér med klokken" className={btn}>↻</button>
        <button onClick={rotate180} title="Snu 180°" className={rotation === 180 ? btnOn : btn}>180°</button>
        <div className="w-px h-5 bg-gray-700 mx-0.5" />
        <button
          onClick={() => {
            setCropLeft(0); setCropTop(0); setCropRight(0); setCropBottom(0)
            updateMut.mutate({ flip_horizontal: !flipH, ...cropReset })
          }}
          title="Speilvend"
          className={flipH ? btnOn : btn}
        >↔</button>
        {photo.exposure_mean != null && (
          <>
            <div className="w-px h-5 bg-gray-700 mx-0.5" />
            <button onClick={autoEnhance} disabled={updateMut.isPending} className={btn}>Auto</button>
          </>
        )}
      </div>

      {mode === 'full' && (
        <CorrectionSliders
          horizonAngle={horizonAngle} exposureEv={exposureEv}
          cropLeft={cropLeft} cropTop={cropTop} cropRight={cropRight} cropBottom={cropBottom}
          onHorizonChange={v => { setHorizonAngle(v); deb({ horizon_angle: v || null }) }}
          onExposureChange={v => { setExposureEv(v); deb({ exposure_ev: v || null }) }}
          onCropLeftChange={v => { setCropLeft(v); deb({ crop_left: v || null }) }}
          onCropTopChange={v => { setCropTop(v); deb({ crop_top: v || null }) }}
          onCropRightChange={v => { setCropRight(v); deb({ crop_right: v || null }) }}
          onCropBottomChange={v => { setCropBottom(v); deb({ crop_bottom: v || null }) }}
        />
      )}
    </div>
  )
}
