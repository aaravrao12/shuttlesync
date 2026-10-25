import { describe, it, expect } from 'vitest'
import { verifyCheckin, qrPayloadFor, rotatingToken, checkToken, verifyDistance, parseQr, encodeQr, TOKEN_WINDOW_MS } from '@/lib/verifyCheckin'
import { makeBuses } from '@/demo/seedData'
import type { Bus } from '@/types'

const NOW = 1_800_000_000_000
const bus: Bus = { ...makeBuses()[0], lastLocation: { lat: 33.02, lng: -96.69, speedMps: 3, heading: 0, accuracyM: 8, updatedAt: NOW - 5000 } }
const near = { lat: 33.02002, lng: -96.69, accuracyM: 10 }
const far = { lat: 33.021, lng: -96.69, accuracyM: 10 }

describe('QR tokens', () => {
  it('rotate every window and validate current/previous only', async () => {
    const t0 = await rotatingToken(bus.qrSecret, NOW)
    const t1 = await rotatingToken(bus.qrSecret, NOW + TOKEN_WINDOW_MS)
    expect(t0).not.toBe(t1)
    expect(await checkToken(bus, { s: 'x', b: bus.id, t: t0 }, NOW)).toBe('current')
    expect(await checkToken(bus, { s: 'x', b: bus.id, t: t0 }, NOW + TOKEN_WINDOW_MS)).toBe('previous')
    expect(await checkToken(bus, { s: 'x', b: bus.id, t: t0 }, NOW + 3 * TOKEN_WINDOW_MS)).toBe('invalid')
  })
  it('rejects a token from another bus', async () => {
    const other = makeBuses()[1]
    const p = await qrPayloadFor(other, 's', NOW, 'rotating')
    expect(await checkToken(bus, p, NOW)).toBe('invalid')
  })
  it('static tokens validate without rotating', async () => {
    const p = await qrPayloadFor(bus, 's', NOW, 'static')
    expect(await checkToken(bus, p, NOW + 99 * TOKEN_WINDOW_MS)).toBe('static')
  })
  it('round-trips through JSON and rejects junk', async () => {
    const p = await qrPayloadFor(bus, 's', NOW, 'rotating')
    expect(parseQr(encodeQr(p))).toEqual(p)
    expect(parseQr('hello')).toBeNull()
  })
})

describe('verifyCheckin', () => {
  const base = { bus, studentId: 'st1', tripId: 'trip1', nowMs: NOW, existing: [] as { studentId: string; tripId: string }[] }
  it('verifies a nearby student with a fresh bus fix', async () => {
    const qr = await qrPayloadFor(bus, 's', NOW, 'rotating')
    const r = await verifyCheckin({ ...base, qr, studentFix: near })
    expect(r).toMatchObject({ accepted: true, verified: true })
  })
  it('far away → unverified with a human reason, still accepted (never an accusation)', async () => {
    const qr = await qrPayloadFor(bus, 's', NOW, 'rotating')
    const r = await verifyCheckin({ ...base, qr, studentFix: far })
    expect(r.accepted).toBe(true); expect(r.verified).toBe(false); expect(r.reason).toMatch(/teacher will confirm/)
  })
  it('location denied → unverified', async () => {
    const qr = await qrPayloadFor(bus, 's', NOW, 'rotating')
    const r = await verifyCheckin({ ...base, qr, studentFix: null })
    expect(r.verified).toBe(false); expect(r.reason).toMatch(/Location was off/)
  })
  it('stale shuttle phone → unverified "Shuttle phone offline"', async () => {
    const stale = { ...bus, lastLocation: { ...bus.lastLocation!, updatedAt: NOW - 60_000 } }
    const qr = await qrPayloadFor(stale, 's', NOW, 'rotating')
    const r = await verifyCheckin({ ...base, bus: stale, qr, studentFix: near })
    expect(r.verified).toBe(false); expect(r.reason).toMatch(/Shuttle phone offline/)
  })
  it('poor GPS widens the allowed distance', () => {
    const d = verifyDistance({ lat: 33.0207, lng: -96.69, accuracyM: 90 }, bus.lastLocation, NOW) // ~78 m away
    expect(d.verified).toBe(true)
  })
  it('duplicate scan is ignored', async () => {
    const qr = await qrPayloadFor(bus, 's', NOW, 'rotating')
    const r = await verifyCheckin({ ...base, qr, studentFix: near, existing: [{ studentId: 'st1', tripId: 'trip1' }] })
    expect(r).toMatchObject({ accepted: false, duplicate: true })
  })
  it('expired QR is rejected with advice', async () => {
    const qr = await qrPayloadFor(bus, 's', NOW - 10 * TOKEN_WINDOW_MS, 'rotating')
    const r = await verifyCheckin({ ...base, qr, studentFix: near })
    expect(r.accepted).toBe(false); expect(r.reason).toMatch(/expired/)
  })
})
