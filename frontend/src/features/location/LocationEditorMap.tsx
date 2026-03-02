import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import type { PhotoListItem } from '../../types/api'
import PlaceSearch from './PlaceSearch'

import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete (L.Icon.Default.prototype as any)._getIconUrl

const blueIcon = new L.Icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

const orangeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 41" width="25" height="41">
  <path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 9.4 12.5 28.5 12.5 28.5S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z" fill="#f97316"/>
  <circle cx="12.5" cy="12.5" r="5" fill="white"/>
</svg>`
const orangeIcon = new L.Icon({
  iconUrl: `data:image/svg+xml;base64,${btoa(orangeSvg)}`,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
})

function ClickHandler({ onAssign }: { onAssign: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onAssign(e.latlng.lat, e.latlng.lng) } })
  return null
}

function FlyToHandler({ target }: { target: { lat: number; lng: number } | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], 12)
  }, [target, map])
  return null
}

interface Props {
  photos: PhotoListItem[]
  onAssign(lat: number, lng: number): void
  onPinClick(hothash: string): void
}

export default function LocationEditorMap({ photos, onAssign, onPinClick }: Props) {
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number } | null>(null)

  const photosWithLocation = photos.filter(p => p.location_lat != null && p.location_lng != null)

  return (
    <div className="relative h-full">
      <div className="absolute top-3 right-3 z-[1000]">
        <PlaceSearch onSelect={coords => setFlyTarget(coords)} />
      </div>
      <MapContainer
        center={[62.0, 10.0]}
        zoom={5}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
        />
        <ClickHandler onAssign={onAssign} />
        <FlyToHandler target={flyTarget} />
        {photosWithLocation.map(p => (
          <Marker
            key={p.hothash}
            position={[p.location_lat!, p.location_lng!]}
            icon={p.location_accuracy === 'exact' ? blueIcon : orangeIcon}
            eventHandlers={{ click: () => onPinClick(p.hothash) }}
          />
        ))}
      </MapContainer>
    </div>
  )
}
