import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Circle, useMap, useMapEvents, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import type { Building, Bus, Stop } from '@/types'
import { bldColor } from '@/components/ui/BuildingBadge'

const buildingIcon = (b: Building) => L.divIcon({
  className: '',
  html: b.zone === 'closed'
    // closed buildings: hazard stripes, so nobody looks for a stop there
    ? `<div style="width:34px;height:34px;border-radius:6px;background:repeating-linear-gradient(45deg,#FFC72C 0 6px,#15171B 6px 12px);color:#fff;display:grid;place-items:center;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"><span style="background:#15171B;padding:0 5px;border-radius:3px;font:800 18px 'Barlow Condensed',sans-serif">${b.code}</span></div>`
    : `<div style="width:34px;height:34px;border-radius:6px;background:${bldColor(b.code)};color:#fff;display:grid;place-items:center;font:800 22px 'Barlow Condensed',sans-serif;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)">${b.code}</div>`,
  iconSize: [34, 34], iconAnchor: [17, 17],
})

const busIcon = (num: string, status: string, simulated?: boolean) => {
  const bg = status === 'delayed' ? 'rgb(var(--warn))' : 'rgb(var(--ink))'
  const fg = status === 'delayed' ? '#fff' : 'rgb(var(--ground))'
  return L.divIcon({
    className: 'bus-marker',
    html: `<div style="padding:3px 7px;border-radius:6px;background:${bg};color:${fg};font:800 17px 'Barlow Condensed',sans-serif;white-space:nowrap;border:2px solid rgb(var(--sign));box-shadow:0 2px 6px rgba(0,0,0,.45)">SHUTTLE ${num}${simulated ? ' · SIM' : ''}</div>`,
    iconSize: [92, 28], iconAnchor: [46, 14],
  })
}

/** A stop sign on a post: bus-yellow disc; the one the student boards at gets a ring. */
const stopIcon = (kind: 'primary' | 'rain', hot: boolean) => L.divIcon({
  className: '',
  html: `<div style="width:24px;height:24px;border-radius:50%;background:${kind === 'rain' ? '#7CC8F0' : 'rgb(var(--sign))'};border:3px solid #15171B;box-shadow:${hot ? '0 0 0 5px rgba(36,82,190,.45),' : ''}0 1px 4px rgba(0,0,0,.5)"></div>`,
  iconSize: [24, 24], iconAnchor: [12, 12],
})

function Fit({ points }: { points: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 17, animate: false })
    // fit once per set of points; later GPS updates must not fight the user's panning
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.map(p => p.join(',')).join('|')])
  return null
}

function ClickCatcher({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: e => onClick(e.latlng.lat, e.latlng.lng) })
  return null
}

interface Props {
  buildings: Building[]
  stops: Stop[]
  buses: Bus[]
  /** show the rain-only stop (it is hidden unless the admin switched it on, or an admin is editing) */
  rainActive?: boolean
  highlightBusId?: string | null
  highlightStopId?: string | null
  showGeofence?: boolean
  height?: number | string
  onBusClick?: (b: Bus) => void
  className?: string
  /** admin editing: click the map to pick a point */
  onMapClick?: (lat: number, lng: number) => void
  /** admin editing: draggable stop markers (the geofence circle follows) */
  onStopMove?: (id: string, lat: number, lng: number) => void
}

/** Leaflet map on free OpenStreetMap tiles. Shuttle markers glide between GPS fixes via a CSS transform transition. */
export function MapView({ buildings, stops, buses, rainActive, highlightBusId, highlightStopId, showGeofence, height = 360, onBusClick, className = '', onMapClick, onStopMove }: Props) {
  const editing = !!onStopMove
  const shownStops = useMemo(() => stops.filter(s => !s.rainOnly || rainActive || editing), [stops, rainActive, editing])
  const pts = useMemo<[number, number][]>(() => [...buildings.filter(b => b.zone !== 'closed').map(b => [b.lat, b.lng] as [number, number]), ...shownStops.map(s => [s.lat, s.lng] as [number, number])], [buildings, shownStops])
  const center: [number, number] = pts[0] ?? [33.03, -96.75]
  const a = stops.find(s => s.zone === 'main' && s.kind === 'primary'), h = stops.find(s => s.zone === 'annex' && s.kind === 'primary')
  return (
    <div className={`rounded-sign overflow-hidden border border-line ${className}`} style={{ height }}>
      <MapContainer center={center} zoom={16} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false} attributionControl>
        <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" maxZoom={19} />
        <Fit points={pts} />
        {onMapClick && <ClickCatcher onClick={onMapClick} />}
        {a && h && <Polyline positions={[[a.lat, a.lng], [h.lat, h.lng]]} pathOptions={{ color: '#7B1E2E', weight: 4, opacity: 0.55, dashArray: '2 9' }} />}
        {showGeofence && shownStops.map(s => <Circle key={s.id} center={[s.lat, s.lng]} radius={s.geofenceRadiusM} pathOptions={{ color: '#2452be', weight: 1, fillOpacity: 0.08 }} />)}
        {shownStops.map(s => (
          <Marker key={'stop-' + s.id} position={[s.lat, s.lng]} icon={stopIcon(s.kind, s.id === highlightStopId)} draggable={editing} zIndexOffset={200} keyboard={false}
            eventHandlers={editing ? { dragend: e => { const ll = (e.target as L.Marker).getLatLng(); onStopMove!(s.id, ll.lat, ll.lng) } } : undefined}>
            <Tooltip direction="top" offset={[0, -12]}>{s.name}{s.approximate ? ' (approximate location)' : ''}</Tooltip>
          </Marker>
        ))}
        {buildings.map(b => <Marker key={b.id} position={[b.lat, b.lng]} icon={buildingIcon(b)} keyboard={false}><Tooltip direction="top" offset={[0, -16]}>{b.zone === 'closed' ? `${b.name}: under construction${b.note ? ` (${b.note})` : ''}` : b.name}</Tooltip></Marker>)}
        {buses.filter(b => b.lastLocation).map(b => (
          <Marker key={b.id} position={[b.lastLocation!.lat, b.lastLocation!.lng]} icon={busIcon(b.number, b.status, b.isSimulated)} zIndexOffset={b.id === highlightBusId ? 1000 : 500}
            eventHandlers={{ click: () => onBusClick?.(b) }} keyboard={false}>
            <Tooltip direction="top" offset={[0, -14]}>{`Shuttle ${b.number}${b.isSimulated ? ' (simulated)' : ''}: ${b.status.replace('_', ' ')}`}</Tooltip>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
