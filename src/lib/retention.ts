// Retention: check-ins (and the one-time student location stored on them) are deleted after 30 days (SPEC §16).
import type { Store } from '@/firebase/store'
import type { Checkin } from '@/types'

export const RETENTION_DAYS = 30
const DAY_MS = 86_400_000

/** Pure so it can be tested: which check-ins are past retention? */
export function expiredCheckins(checkins: Pick<Checkin, 'id' | 'scannedAt'>[], nowMs: number, days = RETENTION_DAYS) {
  return checkins.filter(c => nowMs - c.scannedAt > days * DAY_MS)
}

export async function purgeExpiredCheckins(store: Store, days = RETENTION_DAYS): Promise<number> {
  const rows = await new Promise<Checkin[]>(res => { const u = store.watchCollection<Checkin>('checkins', r => { u(); res(r) }) })
  const old = expiredCheckins(rows, Date.now(), days)
  await Promise.all(old.map(c => store.remove('checkins', c.id)))
  return old.length
}
