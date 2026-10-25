import { Banner } from '@/components/ui/Primitives'
import { Button } from '@/components/ui/Button'
import { useCampus, useNow, useSettings } from '@/firebase/hooks'
import { getStore } from '@/firebase/store'
import { clock, clockAt } from '@/lib/clock'
import { isSchoolDay } from '@/lib/time'
import { useT } from '@/i18n'

/**
 * In demo mode, if it is actually evening or the weekend nothing would happen on screen ("No more shuttles today").
 * Offer a one-tap jump to a passing period with the shuttle simulator running, so first-time visitors see the app alive.
 */
export function OffHours() {
  const t = useT()
  const settings = useSettings()
  const campus = useCampus()
  const now = useNow(5000)
  if (settings.mode !== 'demo' || !clock.isReal() || campus.bell.length < 3) return null
  const first = campus.bell[0], last = campus.bell[campus.bell.length - 1]
  const inSchool = isSchoolDay(new Date(now.nowMs)) && now.minutes >= first.start - 20 && now.minutes <= last.end + 15
  if (inSchool) return null

  async function jump() {
    const store = getStore()
    const p2 = campus.bell.find(b => b.period === 2) ?? campus.bell[1]
    await store.update('settings', 'main', { clock: clockAt(p2.end - 2, 1), simulatorOn: true, simulatorOwner: store.uid() })
  }
  return (
    <Banner tone="info" icon="clock" action={<Button size="sm" onClick={jump} data-testid="offhours-jump">{t('Jump to school time')}</Button>}>
      {t('School is out right now, so the shuttles are not running. Jump to a passing period to see the demo live.')}
    </Banner>
  )
}
