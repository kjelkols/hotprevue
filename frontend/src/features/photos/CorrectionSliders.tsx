interface SliderRowProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  display: (v: number) => string
  onChange: (v: number) => void
}

function SliderRow({ label, value, min, max, step, display, onChange }: SliderRowProps) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 shrink-0 text-gray-400">{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="flex-1 accent-blue-500"
      />
      <span className="w-14 text-right text-gray-300 tabular-nums">{display(value)}</span>
    </div>
  )
}

interface Props {
  horizonAngle: number
  exposureEv: number
  cropLeft: number
  cropTop: number
  cropRight: number
  cropBottom: number
  onHorizonChange: (v: number) => void
  onExposureChange: (v: number) => void
  onCropLeftChange: (v: number) => void
  onCropTopChange: (v: number) => void
  onCropRightChange: (v: number) => void
  onCropBottomChange: (v: number) => void
}

export default function CorrectionSliders({
  horizonAngle, exposureEv, cropLeft, cropTop, cropRight, cropBottom,
  onHorizonChange, onExposureChange,
  onCropLeftChange, onCropTopChange, onCropRightChange, onCropBottomChange,
}: Props) {
  const pct = (v: number) => `${Math.round(v * 100)}%`
  const ev = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)} EV`
  const deg = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}°`

  return (
    <div className="space-y-2">
      <SliderRow label="Horisont" value={horizonAngle} min={-15} max={15} step={0.5}
        display={deg} onChange={onHorizonChange} />
      <SliderRow label="Eksponering" value={exposureEv} min={-2} max={2} step={0.1}
        display={ev} onChange={onExposureChange} />
      <p className="text-xs text-gray-500 pt-1">Beskjæring</p>
      <SliderRow label="Venstre" value={cropLeft} min={0} max={0.3} step={0.01}
        display={pct} onChange={onCropLeftChange} />
      <SliderRow label="Topp" value={cropTop} min={0} max={0.3} step={0.01}
        display={pct} onChange={onCropTopChange} />
      <SliderRow label="Høyre" value={cropRight} min={0} max={0.3} step={0.01}
        display={pct} onChange={onCropRightChange} />
      <SliderRow label="Bunn" value={cropBottom} min={0} max={0.3} step={0.01}
        display={pct} onChange={onCropBottomChange} />
    </div>
  )
}
