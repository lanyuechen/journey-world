import { IconMap } from './actionUi'
import { buildAmapOpenUrl, normalizeMap } from '../lib/model'

/** Clickable place chip — opens 高德 (app if installed, else web). */
export function MapPlaceLink({ map, className = '' }) {
  const place = normalizeMap(map)
  const href = buildAmapOpenUrl(place)
  if (!place || !href) return null

  const label = place.address
    ? `${place.name} · ${place.address}`
    : place.name

  return (
    <a
      className={`trip-map-link${className ? ` ${className}` : ''}`}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title="在高德地图中打开"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <IconMap className="trip-map-icon" />
      <span className="trip-map-text">{label}</span>
    </a>
  )
}
