import { test, expect } from '@playwright/test'

// SPEC §15: 360–1920px with no horizontal scroll on every screen.
const WIDTHS = [360, 390, 768, 1440, 1920]
const STOP_A = { latitude: 33.0193, longitude: -96.6988 }

test('no horizontal scroll at any width', async ({ browser }) => {
  test.setTimeout(300_000) // 21 routes x 5 widths
  // reduced motion = the poster hero; the cinematic hero has its own check in cinema.spec.ts
  const ctx = await browser.newContext({ geolocation: STOP_A, permissions: ['geolocation'], reducedMotion: 'reduce' })
  const p = await ctx.newPage()
  await p.goto('/start?slot=layout')
  await p.getByTestId('load-demo').click()
  await p.getByTestId('demo-student-S01').click()
  await p.getByTestId('consent-accept').click()
  await p.getByText('Skip').click().catch(() => {})
  await p.goto('/teacher?slot=layoutT')
  await p.getByTestId('staff-pin').fill('plano'); await p.getByTestId('staff-unlock').click()
  await p.getByTestId('teacher-t-rivera').click()
  const routes = ['/', '/start', '/privacy', '/how-it-works', '/results', '/changelog', '/student', '/student/scan', '/student/bus', '/student/ask', '/student/settings', '/teacher', '/teacher/classes', '/teacher/reports', '/admin', '/demo', '/test', '/baseline', '/pitch', '/kiosk', '/bus']
  const wide: string[] = []
  for (const w of WIDTHS) {
    await p.setViewportSize({ width: w, height: 900 })
    for (const r of routes) {
      // student routes need the student profile, others the teacher one; both live in separate slots, so switch slot per route
      const slot = r.startsWith('/student') ? 'layout' : 'layoutT'
      await p.goto(`${r}?slot=${slot}`)
      await p.waitForTimeout(250)
      const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      if (over > 1) wide.push(`${r} @${w}px overflows by ${over}px`)
    }
  }
  expect(wide).toEqual([])
  await ctx.close()
})
