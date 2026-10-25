// Geofencing = "is the bus inside the circle around this stop?".
// Two details keep it from flickering with noisy GPS:
//  1. HYSTERESIS: you enter at radius R but only count as having left at 1.5 × R.
//  2. DEBOUNCE: a change must hold for `debounceMs` before we announce it.
import type { LatLng, Stop } from '@/types'

const R_EARTH_M = 6_371_000
const toRad = (d: number) => (d * Math.PI) / 180

/** Great-circle distance in meters (haversine formula). */
export function haversineM(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R_EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

export const EXIT_FACTOR = 1.5

export interface GeofenceState {
  /** stop we have confirmed the bus is at (after debounce) */
  atStopId: string | null
  /** a candidate transition waiting out the debounce timer */
  pending: { kind: 'enter' | 'exit'; stopId: string; since: number } | null
}

export type GeofenceEvent = { type: 'bus_arrived' | 'bus_departed'; stopId: string; at: number }

export const initialGeofence = (): GeofenceState => ({ atStopId: null, pending: null })

/**
 * Pure reducer: feed one GPS fix, get the new state and any confirmed events.
 * @param debounceMs how long a candidate must persist (default 6 s ≈ one or two GPS writes)
 */
export function stepGeofence(
  state: GeofenceState,
  loc: LatLng,
  stops: Stop[],
  nowMs: number,
  debounceMs = 6000,
): { state: GeofenceState; events: GeofenceEvent[] } {
  const events: GeofenceEvent[] = []
  let { atStopId, pending } = state

  if (atStopId) {
    const stop = stops.find(s => s.id === atStopId)
    const dist = stop ? haversineM(loc, stop) : Infinity
    const outside = !stop || dist > stop.geofenceRadiusM * EXIT_FACTOR
    if (outside) {
      if (pending?.kind === 'exit' && pending.stopId === atStopId) {
        if (nowMs - pending.since >= debounceMs) {
          events.push({ type: 'bus_departed', stopId: atStopId, at: nowMs })
          atStopId = null
          pending = null
        }
      } else {
        pending = { kind: 'exit', stopId: atStopId, since: nowMs }
      }
    } else if (pending?.kind === 'exit') {
      pending = null // came back inside before the debounce finished: ignore the blip
    }
    return { state: { atStopId, pending }, events }
  }

  // Not at any stop: find the nearest stop whose ENTER radius we are inside.
  let nearest: Stop | null = null
  let nearestDist = Infinity
  for (const s of stops) {
    const d = haversineM(loc, s)
    if (d <= s.geofenceRadiusM && d < nearestDist) { nearest = s; nearestDist = d }
  }
  if (nearest) {
    if (pending?.kind === 'enter' && pending.stopId === nearest.id) {
      if (nowMs - pending.since >= debounceMs) {
        events.push({ type: 'bus_arrived', stopId: nearest.id, at: nowMs })
        atStopId = nearest.id
        pending = null
      }
    } else {
      pending = { kind: 'enter', stopId: nearest.id, since: nowMs }
    }
  } else if (pending?.kind === 'enter') {
    pending = null
  }
  return { state: { atStopId, pending }, events }
}
