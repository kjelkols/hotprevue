import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import useLocationEditorStore from '../stores/useLocationEditorStore'
import { listPhotos, patchPhoto } from '../api/photos'
import LocationPhotoStrip from '../features/location/LocationPhotoStrip'
import LocationEditorMap from '../features/location/LocationEditorMap'

export default function LocationEditorPage() {
  const hothashes = useLocationEditorStore(s => s.hothashes)
  const queryClient = useQueryClient()
  const [stripSelected, setStripSelected] = useState<Set<string>>(new Set())

  const { data: photos = [] } = useQuery({
    queryKey: ['location-editor-photos', hothashes],
    queryFn: () => listPhotos({ hothashes }),
    enabled: hothashes.length > 0,
  })

  function toggleStrip(hothash: string) {
    setStripSelected(prev => {
      const next = new Set(prev)
      if (next.has(hothash)) next.delete(hothash)
      else next.add(hothash)
      return next
    })
  }

  async function onAssign(lat: number, lng: number) {
    const targets = Array.from(stripSelected)
    if (targets.length === 0) return
    await Promise.all(
      targets.map(hothash =>
        patchPhoto(hothash, { location_lat: lat, location_lng: lng, location_source: 1, location_accuracy: 'manual' })
      )
    )
    queryClient.invalidateQueries({ queryKey: ['location-editor-photos', hothashes] })
  }

  function onPinClick(hothash: string) {
    setStripSelected(prev => {
      const next = new Set(prev)
      if (next.has(hothash)) next.delete(hothash)
      else next.add(hothash)
      return next
    })
  }

  return (
    <div className="flex h-full">
      <div className="w-[35%] overflow-y-auto border-r border-gray-800 shrink-0">
        <LocationPhotoStrip
          photos={photos}
          stripSelected={stripSelected}
          onToggle={toggleStrip}
          onSetSelected={setStripSelected}
        />
      </div>
      <div className="flex-1">
        <LocationEditorMap
          photos={photos}
          onAssign={onAssign}
          onPinClick={onPinClick}
        />
      </div>
    </div>
  )
}
