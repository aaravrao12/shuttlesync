import { test, expect, type Page } from '@playwright/test'

// The demo Building A loop (src/demo/seedData.ts): the "shuttle" and the "student" stand at the same place.
const A_LOOP = { latitude: 33.027724, longitude: -96.7528 }

// The simulator's loop is 14 school-minutes long and phase = clock mod 14. 10:49 = minute 649 = 46*14 + 5, i.e. Shuttle 1
// has JUST arrived at the A loop and waits there for 2 minutes. Period 2 ends 10:51 and the period-3 bell is 11:03 (real bell schedule).
const SHUTTLE_AT_A = '10:49'

async function control(ctx: import('@playwright/test').BrowserContext) {
  const c = await ctx.newPage()
  await c.goto('/start?slot=control')
  await c.getByTestId('load-demo').click()
  await c.goto('/demo')
  await c.getByTestId('staff-pin').fill('plano')
  await c.getByTestId('staff-unlock').click()
  await c.getByTestId('seed-demo').click()
  await c.getByTestId('jump-input').fill(SHUTTLE_AT_A)
  await c.getByTestId('jump-go').click()
  return c
}
const startSim = async (c: Page) => { await c.getByText('Run the shuttle simulator on this device').click(); await expect(c.getByText('boarding').first()).toBeVisible() }

async function teacher(ctx: import('@playwright/test').BrowserContext) {
  const t = await ctx.newPage()
  await t.goto('/teacher?slot=teacher')
  await t.getByTestId('staff-pin').fill('plano')
  await t.getByTestId('staff-unlock').click()
  await t.getByTestId('teacher-t-rivera').click()
  return t
}

test('live loop: student sees "On track", scans, teacher sees them live, the run completes → Arrived', async ({ browser }) => {
  const ctx = await browser.newContext({ geolocation: A_LOOP, permissions: ['geolocation'], viewport: { width: 1280, height: 900 } })
  const ctl = await control(ctx)
  const t = await teacher(ctx)
  const maya = t.getByTestId('row-S01')
  await expect(maya).toHaveAttribute('data-status', 'waiting') // before the bell, not checked in yet

  const student = await ctx.newPage()
  await student.setViewportSize({ width: 390, height: 844 })
  await student.goto('/start?slot=student')
  await student.getByTestId('demo-student-S01').click()
  await student.getByTestId('consent-accept').click()
  await student.getByText('Skip').click().catch(() => {})
  await startSim(ctl)

  // No timetable and no bus to choose: the screen says whether the shuttle is needed and whether she will make it.
  await expect(student.getByTestId('next-move')).toBeVisible()
  await expect(student.getByTestId('verdict')).toHaveAttribute('data-verdict', 'on_track')
  await expect(student.getByTestId('shuttle-shuttle1')).toContainText('Building A loop')

  // Scan near the end of the boarding wait (10:50, still at the A loop) so the ride is comfortably inside the normal time
  await ctl.getByTestId('jump-input').fill('10:50')
  await ctl.getByTestId('jump-go').click()
  await student.goto('/student/scan')
  await student.getByText('Demo shortcut: pretend to scan').click()
  await student.getByTestId('demo-scan-shuttle1').click()
  await expect(student.getByTestId('scan-result')).toContainText('You are checked in')

  // the teacher's roster changes live, without a refresh
  await expect(maya).toHaveAttribute('data-status', 'on_the_way')

  // the shuttle reaches Building H: the run completes and the rider shows Arrived
  await ctl.getByTestId('jump-input').fill('10:56')
  await ctl.getByTestId('jump-go').click()
  await expect(maya).toHaveAttribute('data-status', 'arrived', { timeout: 60_000 })
  await ctx.close()
})

test('a slow shuttle excuses riders who checked in; riders who skip are not excused', async ({ browser }) => {
  const ctx = await browser.newContext({ geolocation: A_LOOP, permissions: ['geolocation'], viewport: { width: 1280, height: 900 } })
  const ctl = await control(ctx)
  await startSim(ctl)
  await expect(ctl.getByTestId('sim-in-S01')).toBeEnabled()
  await ctl.getByTestId('sim-skip-S02').click() // Jordan skips
  await ctl.getByTestId('sim-in-all').click() // everyone else checks in
  await ctl.getByTestId('slow-shuttle1').click() // "Make Shuttle 1 slow"
  const t = await teacher(ctx)
  await expect(t.getByTestId('row-S01')).toHaveAttribute('data-status', 'excused_bus_late')
  await expect(t.getByTestId('row-S02')).toHaveAttribute('data-status', 'waiting') // not checked in: not excused
  await ctx.close()
})

test('students who stay in one zone never see the shuttle screen', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const ctl = await control(ctx)
  await ctl.getByTestId('jump-input').fill('10:30') // during period 2: Liam (AAADDEEE) walks indoors A→D before P3
  await ctl.getByTestId('jump-go').click()
  const s = await ctx.newPage()
  await s.goto('/start?slot=liam')
  await s.getByTestId('demo-student-S08').click()
  await s.getByTestId('consent-accept').click()
  await s.getByText('Skip').click().catch(() => {})
  await expect(s.getByTestId('no-shuttle')).toContainText('No shuttle needed')
  await ctx.close()
})

test('admin: stops ship as approximate, the rain-stop toggle reaches students, and the normal ride time changes the verdict', async ({ browser }) => {
  const ctx = await browser.newContext({ geolocation: A_LOOP, permissions: ['geolocation'], viewport: { width: 1280, height: 900 } })
  const ctl = await control(ctx)
  await startSim(ctl)

  const student = await ctx.newPage()
  await student.setViewportSize({ width: 390, height: 844 })
  await student.goto('/start?slot=student')
  await student.getByTestId('demo-student-S01').click()
  await student.getByTestId('consent-accept').click()
  await student.getByText('Skip').click().catch(() => {})
  await expect(student.getByTestId('verdict')).toHaveAttribute('data-verdict', 'on_track')

  const admin = await ctx.newPage()
  await admin.goto('/admin?slot=admin')
  await admin.getByTestId('staff-pin').fill('plano')
  await admin.getByTestId('staff-unlock').click()
  await expect(admin.getByText('Approximate: confirm on site').first()).toBeVisible() // stop coordinates are not confirmed yet
  await admin.getByText('Rain stop active (east lot by the pond)').click()
  await student.goto('/student/bus')
  await expect(student.getByText('Rain stop is on: D and E students meet the shuttle at the east lot by the pond.')).toBeVisible()

  // a 20-minute normal ride cannot fit before the 11:03 bell from 10:49 → "Likely late"
  await admin.getByTestId('tab-shuttles').click()
  await admin.getByTestId('rule-normalRideMin').fill('20')
  await admin.getByTestId('rule-normalRideMin').blur()
  await student.goto('/student')
  await expect(student.getByTestId('verdict')).toHaveAttribute('data-verdict', 'late')
  await ctx.close()
})
