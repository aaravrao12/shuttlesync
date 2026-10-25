import { describe, it, expect } from 'vitest'
import { processBusFix, freshGeofence, initialRun } from '@/lib/busEngine'
import { activeStops, DEFAULT_RULES } from '@/lib/shuttle'
import { STOPS, makeBuses } from '@/demo/seedData'
import type { Bus, BusLocation, Run, Stop } from '@/types'

const A = STOPS[0], H = STOPS[1], RAIN = STOPS[2]
const DATE = '2026-02-03'
const at = (s: Stop, northM = 0, speed = 0): BusLocation => ({ lat: s.lat + northM / 111_320, lng: s.lng, speedMps: speed, heading: 0, accuracyM: 5, updatedAt: 0 })

/** Drive the engine like a real phone: feed fixes, write the results back, repeat. */
function driver(rain = false) {
  const stops = activeStops(STOPS, { ...DEFAULT_RULES, rainStopActive: rain })
  let bus: Bus = makeBuses()[0]
  let geo = freshGeofence()
  const runs = new Map<string, Run>()
  const events: string[] = []
  return {
    runs, events, get bus() { return bus },
    feed(loc: BusLocation, nowMin: number, nowMs: number) {
      const out = processBusFix({ bus, fix: loc, run: bus.activeRunId ? runs.get(bus.activeRunId) ?? null : null, stops, geofence: geo, nowMin, nowMs, date: DATE, rules: { ...DEFAULT_RULES, rainStopActive: rain } })
      geo = out.geofence; bus = { ...bus, ...out.busPatch }
      for (const r of out.runUpserts) runs.set(r.id, r)
      events.push(...out.events.map(e => e.type))
      return out
    },
    current: () => runs.get(bus.activeRunId ?? '') as Run,
  }
}

describe('run detection (no timetable: runs come from the shuttle GPS)', () => {
  it('A → H: boarding at A, in transit when it leaves, completed when it reaches H, then boarding at H', () => {
    const d = driver()
    d.feed(at(A), 600, 0); d.feed(at(A), 600.1, 8000) // enters the A geofence for 6+ s
    expect(d.current()).toMatchObject({ status: 'boarding', fromZone: 'main', toZone: 'annex', fromStopId: 'stop-a', boardingAt: 600.1 })
    expect(d.bus.status).toBe('boarding'); expect(d.bus.currentStopId).toBe('stop-a')

    d.feed(at(A, 300, 4), 602, 20_000); d.feed(at(A, 300, 4), 602.2, 28_000) // leaves (beyond 1.5x radius) and stays out
    expect(d.current()).toMatchObject({ status: 'in_transit', departedAt: 602.2 })
    expect(d.bus.currentStopId).toBeNull(); expect(d.bus.nextStopId).toBe('stop-h')

    d.feed(at(H), 607, 40_000); d.feed(at(H), 607.2, 48_000)
    const done = [...d.runs.values()].find(r => r.fromZone === 'main')!
    expect(done).toMatchObject({ status: 'completed', arrivedAt: 607.2, arrivedStopId: 'stop-h' })
    expect(d.current()).toMatchObject({ status: 'boarding', fromZone: 'annex', toZone: 'main', fromStopId: 'stop-h' }) // the loop continues
    expect(d.runs.size).toBe(2)
    expect(d.events).toEqual(['bus_arrived', 'bus_departed', 'bus_arrived'])
  })

  it('run ids are deterministic and increase, so two devices cannot create duplicates', () => {
    const d = driver()
    d.feed(at(A), 600, 0); d.feed(at(A), 600.1, 8000)
    expect([...d.runs.keys()]).toEqual([`${DATE}_shuttle1_1`])
  })

  it('a hop inside the zone (A loop → rain stop) is NOT a real run: it goes back to boarding', () => {
    const d = driver(true)
    d.feed(at(A), 600, 0); d.feed(at(A), 600.1, 8000)
    d.feed(at(A, 200, 3), 601, 20_000); d.feed(at(A, 200, 3), 601.2, 28_000)
    expect(d.current().status).toBe('in_transit')
    d.feed(at(RAIN), 602, 40_000); d.feed(at(RAIN), 602.2, 48_000) // arrives at another main-campus stop
    expect(d.current()).toMatchObject({ status: 'boarding', fromZone: 'main', fromStopId: 'stop-rain', departedAt: null })
    expect(d.runs.size).toBe(1) // still the same run
  })

  it('flags a slow ride once (and only once)', () => {
    const d = driver()
    d.feed(at(A), 600, 0); d.feed(at(A), 600.1, 8000)
    d.feed(at(A, 300, 4), 602, 20_000); d.feed(at(A, 300, 4), 602.2, 28_000)
    const mid = at(A, 300, 0)
    const first = d.feed(mid, 612, 100_000) // 10 min into a ride that should take ~5 and it is still near A
    expect(first.busPatch.status).toBe('delayed')
    expect(first.events.map(e => e.type)).toContain('bus_delayed')
    const again = d.feed(mid, 612.5, 130_000)
    expect(again.events.map(e => e.type)).not.toContain('bus_delayed')
    expect((first.busPatch.delayMinutes ?? 0)).toBeGreaterThan(DEFAULT_RULES.delayThresholdMin)
  })

  it('a dispatch heads-up marks a shuttle that is still boarding as slow immediately', () => {
    const d = driver()
    d.feed(at(A), 600, 0); d.feed(at(A), 600.1, 8000)
    d.bus.reportedDelayMin = 9
    const out = d.feed(at(A), 600.5, 20_000)
    expect(out.busPatch.status).toBe('delayed')
  })
})

describe('starting a phone mid-loop', () => {
  it('"at the H loop" opens a boarding run there', () => {
    const r = initialRun({ bus: makeBuses()[0], date: DATE, nowMin: 610, at: H, stops: STOPS })
    expect(r.run).toMatchObject({ status: 'boarding', fromZone: 'annex', toZone: 'main', fromStopId: 'stop-h' }); expect(r.geofence.atStopId).toBe('stop-h')
  })
  it('"on the road to the main campus" opens an in-transit run from the annex', () => {
    const r = initialRun({ bus: makeBuses()[0], date: DATE, nowMin: 610, toward: 'main', stops: STOPS })
    expect(r.run).toMatchObject({ status: 'in_transit', fromZone: 'annex', toZone: 'main', departedAt: 610 })
  })
})
