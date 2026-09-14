import { IconMap } from './actionUi'
import { normalizeMap, openInAmap } from '../lib/model'

/** Clickable place chip — opens 高德 (app if installed, else web). */
export function MapPlaceLink({ map, className = '' }) {
  const place = normalizeMap(map)
  if (!place) return null

  const label = place.address
    ? `${place.name} · ${place.address}`
    : place.name

  return (
    <button
      type="button"
      className={`trip-map-link${className ? ` ${className}` : ''}`}
      title="在高德地图中打开"
      onClick={(e) => {
        e.stopPropagation()
        openInAmap(place)
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <IconMap className="trip-map-icon" />
      <span className="trip-map-text">{label}</span>
    </button>
  )
}
