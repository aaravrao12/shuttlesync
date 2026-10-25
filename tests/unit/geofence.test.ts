import { describe, it, expect } from 'vitest'
import { haversineM, stepGeofence, initialGeofence } from '@/lib/geofence'
import { STOPS } from '@/demo/seedData'

const stop = STOPS[0]
const at = (metersNorth: number) => ({ lat: stop.lat + metersNorth / 111_320, lng: stop.lng })

describe('haversine', () => {
  it('is ~111 km per degree of latitude and zero for same point', () => {
    expect(haversineM({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeGreaterThan(111_000)
    expect(haversineM({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeLessThan(111_400)
    expect(haversineM(stop, stop)).toBe(0)
  })
})

describe('geofence hysteresis + debounce', () => {
  it('announces arrival only after the debounce, once', () => {
    let s = initialGeofence()
    let r = stepGeofence(s, at(10), STOPS, 0); s = r.state
    expect(r.events).toHaveLength(0)
    r = stepGeofence(s, at(10), STOPS, 3000); s = r.state
    expect(r.events).toHaveLength(0)
    r = stepGeofence(s, at(10), STOPS, 7000); s = r.state
    expect(r.events).toEqual([{ type: 'bus_arrived', stopId: stop.id, at: 7000 }])
    r = stepGeofence(s, at(10), STOPS, 20000)
    expect(r.events).toHaveLength(0)
  })
  it('does not leave at 1.2x radius (inside hysteresis band) but does at >1.5x', () => {
    let s = { atStopId: stop.id, pending: null } as ReturnType<typeof initialGeofence>
    let r = stepGeofence(s, at(stop.geofenceRadiusM * 1.2), STOPS, 0); s = r.state
    r = stepGeofence(s, at(stop.geofenceRadiusM * 1.2), STOPS, 10000); s = r.state
    expect(s.atStopId).toBe(stop.id)
    r = stepGeofence(s, at(stop.geofenceRadiusM * 1.8), STOPS, 20000); s = r.state
    r = stepGeofence(s, at(stop.geofenceRadiusM * 1.8), STOPS, 27000)
    expect(r.events[0]).toMatchObject({ type: 'bus_departed', stopId: stop.id })
  })
  it('ignores a GPS blip: re-entering before debounce cancels the exit', () => {
    let s = { atStopId: stop.id, pending: null } as ReturnType<typeof initialGeofence>
    s = stepGeofence(s, at(100), STOPS, 0).state
    expect(s.pending?.kind).toBe('exit')
    s = stepGeofence(s, at(5), STOPS, 2000).state
    expect(s.pending).toBeNull()
    expect(s.atStopId).toBe(stop.id)
  })
})
