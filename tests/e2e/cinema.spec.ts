import { test, expect } from '@playwright/test'

// The cinematic scroll hero (desktop, motion allowed): frames load, the headline shows at the top, the canvas paints, the live
// "Will I make it?" card appears mid-scroll, and the page never scrolls sideways.
test('cinematic hero paints, reveals its beats on scroll and does not overflow', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const p = await ctx.newPage()
  await p.goto('/')
  await expect(p.getByTestId('cinema')).toBeVisible()
  await expect(p.getByRole('heading', { level: 1 })).toContainText("student isn't")
  await expect.poll(() => p.evaluate(() => { const c = document.querySelector('[data-testid=chapter-aerial] canvas') as HTMLCanvasElement; const d = c.getContext('2d')!.getImageData(c.width / 2 | 0, c.height / 2 | 0, 1, 1).data; return d[0] + d[1] + d[2] })).toBeGreaterThan(30) // a real frame, not a blank canvas
  await p.mouse.move(700, 500)
  await p.mouse.wheel(0, 1700)
  await expect(p.getByText('A shuttle can pick you up in about')).toBeVisible({ timeout: 15_000 })
  expect(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  await ctx.close()
})
