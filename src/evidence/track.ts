// Anonymous analytics (SPEC §11). Writes to the `analytics` collection: a random per-tab session id,
// the role, and what happened. No names, no student ids, no locations. A global switch turns it all off.
import { getStore } from '@/firebase/store'
import { sessionId } from '@/app/session'
import type { AppSettings } from '@/types'

let ctx: { mode: AppSettings['mode']; off: boolean; role: string } = { mode: 'demo', off: false, role: 'visitor' }

/** Called from a root hook whenever settings or profile change. */
export function setTrackContext(c: Partial<typeof ctx>) { ctx = { ...ctx, ...c } }

export type TrackType =
  | 'onboarding_started' | 'onboarding_completed' | 'schedule_photo_used' | 'schedule_manual'
  | 'scan_attempt' | 'scan_success' | 'scan_unverified' | 'scan_failed' | 'kiosk_checkin'
  | 'teacher_override' | 'dashboard_open' | 'ai_note_generated' | 'ai_note_approved' | 'ai_note_edited'
  | 'error_shown' | 'screen_view' | 'feedback_open' | 'consent_given'

export function track(type: TrackType, props: Record<string, unknown> = {}) {
  if (ctx.off) return
  try {
    const store = getStore()
    // Demo-mode events are labeled simulated so they can never leak into the Results page by accident.
    void store.add('analytics', {
      type, role: ctx.role, sessionId: sessionId(), props,
      createdAt: Date.now(), isPilot: ctx.mode === 'pilot', isSimulated: ctx.mode !== 'pilot',
    })
  } catch { /* analytics must never break the app */ }
}
