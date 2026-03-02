import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import type { PhotoDetail } from '../../types/api'

// Bundled Leaflet icon assets (avoids CDN dependency)
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

// Orange marker via SVG data URL for manual/user-assigned locations
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

export default function PhotoLocationMap({ photo }: { photo: PhotoDetail }) {
  const hasLocation = photo.location_lat != null && photo.location_lng != null
  const isGps = photo.location_source === 0
  const center: [number, number] = hasLocation
    ? [photo.location_lat!, photo.location_lng!]
    : [59.91, 10.75]

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-gray-500">Sted</p>
        {hasLocation && (
          <span className={`text-xs px-1.5 py-0.5 rounded ${isGps ? 'bg-blue-900 text-blue-300' : 'bg-orange-900 text-orange-300'}`}>
            {isGps ? 'GPS' : 'Manuelt'}
          </span>
        )}
      </div>

      <div className="rounded overflow-hidden border border-gray-700" style={{ height: 200 }}>
        <MapContainer
          center={center}
          zoom={hasLocation ? 13 : 5}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
          />
          {hasLocation && (
            <Marker
              position={[photo.location_lat!, photo.location_lng!]}
              icon={isGps ? blueIcon : orangeIcon}
            />
          )}
        </MapContainer>
      </div>

      {hasLocation && (
        <p className="text-xs text-gray-600 mt-1">
          {photo.location_lat!.toFixed(5)}, {photo.location_lng!.toFixed(5)}
        </p>
      )}
    </div>
  )
}
