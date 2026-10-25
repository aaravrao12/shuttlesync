import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// WCAG 2.x A/AA automated audit (axe). Automated checks catch roughly a third of issues, so docs/TESTING.md also lists manual checks.
const STOP_A = { latitude: 33.0193, longitude: -96.6988 }

async function audit(page: Page, label: string) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('.leaflet-container').analyze()
  const bad = r.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')
  expect.soft(bad.map(v => `${label}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.html.slice(0, 110)}`), label).toEqual([])
}

test.describe('accessibility', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`public + student + teacher screens (${theme})`, async ({ browser }) => {
      const ctx = await browser.newContext({ geolocation: STOP_A, permissions: ['geolocation'], viewport: { width: 1280, height: 900 }, colorScheme: theme, reducedMotion: 'reduce' })
      const p = await ctx.newPage()
      await p.goto('/start?slot=a11y')
      await p.getByTestId('load-demo').click()
      await p.waitForTimeout(300)
      await audit(p, `start ${theme}`)
      for (const path of ['/privacy', '/how-it-works', '/results', '/changelog']) { await p.goto(path); await p.waitForTimeout(400); await audit(p, `${path} ${theme}`) }
      await p.goto('/'); await p.waitForTimeout(1500); await audit(p, `landing ${theme}`)

      // student (phone)
      await p.setViewportSize({ width: 390, height: 844 })
      await p.goto('/start?slot=a11y')
      await p.getByTestId('demo-student-S01').click()
      await audit(p, `consent ${theme}`)
      await p.getByTestId('consent-accept').click()
      await p.getByText('Skip').click().catch(() => {})
      await p.waitForTimeout(500); await audit(p, `student today ${theme}`)
      for (const path of ['/student/scan', '/student/bus', '/student/ask', '/student/settings']) { await p.goto(path); await p.waitForTimeout(700); await audit(p, `${path} ${theme}`) }

      // teacher (desktop)
      await p.setViewportSize({ width: 1280, height: 900 })
      await p.goto('/teacher?slot=a11yt')
      await p.getByTestId('staff-pin').fill('plano'); await p.getByTestId('staff-unlock').click()
      await p.getByTestId('teacher-t-rivera').click()
      await p.waitForTimeout(800); await audit(p, `dashboard ${theme}`)
      await ctx.close()
    })
  }
})

// The default audit runs at a real clock time (usually outside school hours), so the live states were never on screen.
// This one starts the shuttle simulator at a passing period and audits the screens that show verdicts, shuttles and the roster.
test.describe('accessibility, live shuttle state', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`verdict, live shuttles, map, roster (${theme})`, async ({ browser }) => {
      const ctx = await browser.newContext({ geolocation: { latitude: 33.027724, longitude: -96.7528 }, permissions: ['geolocation'], viewport: { width: 390, height: 844 }, colorScheme: theme })
      const c = await ctx.newPage()
      await c.goto('/start?slot=ctl'); await c.getByTestId('load-demo').click()
      await c.goto('/demo'); await c.getByTestId('staff-pin').fill('plano'); await c.getByTestId('staff-unlock').click()
      await c.getByTestId('seed-demo').click(); await c.getByTestId('jump-input').fill('10:49'); await c.getByTestId('jump-go').click()
      await c.getByText('Run the shuttle simulator on this device').click()
      await expect(c.getByText('boarding').first()).toBeVisible()

      const s = await ctx.newPage()
      await s.goto('/start?slot=live'); await s.getByTestId('demo-student-S01').click(); await s.getByTestId('consent-accept').click()
      await s.getByText('Skip').click().catch(() => {})
      await expect(s.getByTestId('verdict')).toBeVisible()
      await audit(s, `live today ${theme}`)
      await s.goto('/student/bus'); await expect(s.getByTestId('shuttle-shuttle1')).toBeVisible(); await audit(s, `live shuttles ${theme}`)
      await s.goto('/student/scan'); await s.getByText('Demo shortcut: pretend to scan').click(); await s.getByTestId('demo-scan-shuttle1').click()
      await expect(s.getByTestId('scan-result')).toBeVisible(); await audit(s, `scan result ${theme}`)

      await s.setViewportSize({ width: 1280, height: 900 })
      await s.goto('/teacher?slot=livet'); await s.getByTestId('staff-pin').fill('plano'); await s.getByTestId('staff-unlock').click(); await s.getByTestId('teacher-t-rivera').click()
      await expect(s.getByTestId('row-S01')).toBeVisible(); await audit(s, `live roster ${theme}`)
      await ctx.close()
    })
  }
})
