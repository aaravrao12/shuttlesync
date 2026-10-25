// Check-in verification (SPEC §8.4). Principle: a failed check is "unverified — teacher decides",
// never an accusation. Three independent signals:
//   1. TOKEN: the QR carries an HMAC token that rotates every 60 s, so a screenshot goes stale fast.
//   2. DISTANCE: the student's phone should be near the bus phone at the instant of the scan.
//   3. FRESHNESS: the bus location must be recent (< 30 s) or we cannot judge distance.
import type { Bus, BusLocation, LatLng } from '@/types'
import { haversineM } from './geofence'

export const TOKEN_WINDOW_MS = 60_000
export const MIN_VERIFY_DISTANCE_M = 75
export const BUS_FRESH_MS = 30_000

const enc = new TextEncoder()

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export const windowIndex = (nowMs: number) => Math.floor(nowMs / TOKEN_WINDOW_MS)

/** 10 hex chars is plenty: tokens expire in ~2 minutes and also need proximity. */
export async function rotatingToken(secret: string, nowMs: number): Promise<string> {
  return (await hmacHex(secret, `w:${windowIndex(nowMs)}`)).slice(0, 10)
}

/** Printed QR sheets cannot rotate, so their token is fixed; they rely on location only. */
export async function staticToken(secret: string): Promise<string> {
  return (await hmacHex(secret, 'static')).slice(0, 10)
}

export interface QrPayload { s: string; b: string; t: string; k?: 'static' }

export function encodeQr(p: QrPayload): string { return JSON.stringify(p) }

export function parseQr(text: string): QrPayload | null {
  try {
    const o = JSON.parse(text)
    if (o && typeof o.s === 'string' && typeof o.b === 'string' && typeof o.t === 'string') return o as QrPayload
  } catch { /* not JSON */ }
  return null
}

export async function qrPayloadFor(bus: Pick<Bus, 'id' | 'qrSecret'>, schoolId: string, nowMs: number, mode: 'rotating' | 'static'): Promise<QrPayload> {
  return mode === 'rotating'
    ? { s: schoolId, b: bus.id, t: await rotatingToken(bus.qrSecret, nowMs) }
    : { s: schoolId, b: bus.id, t: await staticToken(bus.qrSecret), k: 'static' }
}

export type TokenResult = 'current' | 'previous' | 'static' | 'invalid'

export async function checkToken(bus: Pick<Bus, 'id' | 'qrSecret'>, qr: QrPayload, nowMs: number): Promise<TokenResult> {
  if (qr.b !== bus.id) return 'invalid'
  if (qr.k === 'static') return qr.t === (await staticToken(bus.qrSecret)) ? 'static' : 'invalid'
  if (qr.t === (await rotatingToken(bus.qrSecret, nowMs))) return 'current'
  // Allow the previous window so a scan that straddles the minute boundary still works.
  if (qr.t === (await rotatingToken(bus.qrSecret, nowMs - TOKEN_WINDOW_MS))) return 'previous'
  return 'invalid'
}

export interface StudentFix extends LatLng { accuracyM: number }

export interface VerifyInput {
  qr: QrPayload
  bus: Bus
  studentId: string
  tripId: string
  studentFix: StudentFix | null
  nowMs: number
  /** earlier check-ins; `tripId` holds the id of the shuttle RUN they belong to (name kept from the timetable era) */
  existing: { studentId: string; tripId: string }[]
}

export interface VerifyResult {
  /** false = nothing is recorded (bad QR, or already checked in) */
  accepted: boolean
  duplicate: boolean
  verified: boolean
  reason: string
  distanceToBusM: number | null
  token: TokenResult
}

const reject = (reason: string, token: TokenResult = 'invalid', duplicate = false): VerifyResult =>
  ({ accepted: false, duplicate, verified: false, reason, distanceToBusM: null, token })

export function verifyDistance(student: StudentFix | null, busLoc: BusLocation | undefined, nowMs: number): { verified: boolean; reason: string; distanceM: number | null } {
  if (!student) return { verified: false, reason: 'Location was off, so your teacher will confirm.', distanceM: null }
  if (!busLoc || nowMs - busLoc.updatedAt > BUS_FRESH_MS) {
    return { verified: false, reason: 'Shuttle phone offline, so your teacher will confirm.', distanceM: null }
  }
  const dist = haversineM(student, busLoc)
  // Be generous when GPS is poor (indoors, urban canyons): allowed = max(75 m, combined accuracy).
  const allowed = Math.max(MIN_VERIFY_DISTANCE_M, student.accuracyM + (busLoc.accuracyM || 0))
  if (dist <= allowed) return { verified: true, reason: 'On the shuttle: location matches.', distanceM: Math.round(dist) }
  if (student.accuracyM > 150) return { verified: false, reason: 'GPS too inaccurate indoors, so your teacher will confirm.', distanceM: Math.round(dist) }
  return { verified: false, reason: `You were ${Math.round(dist)} m from the shuttle when you scanned, so your teacher will confirm.`, distanceM: Math.round(dist) }
}

export async function verifyCheckin(i: VerifyInput): Promise<VerifyResult> {
  const token = await checkToken(i.bus, i.qr, i.nowMs)
  if (token === 'invalid') {
    return reject(i.qr.b !== i.bus.id ? 'That QR code belongs to a different shuttle.' : 'That QR code has expired. Scan the code on the shuttle screen again.')
  }
  // (`tripId` is the id of the shuttle run the scan belongs to; the field name predates the move from timetable trips to runs.)
  if (i.existing.some(c => c.studentId === i.studentId && c.tripId === i.tripId)) {
    return reject('You are already checked in on this ride.', token, true)
  }
  const d = verifyDistance(i.studentFix, i.bus.lastLocation, i.nowMs)
  return { accepted: true, duplicate: false, verified: d.verified, reason: d.reason, distanceToBusM: d.distanceM, token }
}
