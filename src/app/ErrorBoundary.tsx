import { Component, type ReactNode } from 'react'
import { track } from '@/evidence/track'
import { translate } from '@/i18n'
import { prefs } from './session'

/** If a screen crashes, show what to do next instead of a blank page, and log it (no personal data) for the Results page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error) { try { track('error_shown', { message: String(error.message).slice(0, 120) }) } catch { /* ignore */ } }
  render() {
    if (!this.state.error) return this.props.children
    const t = (k: string) => translate(prefs.lang(), k)
    return (
      <div role="alert" className="min-h-dvh grid place-items-center p-6">
        <div className="max-w-md space-y-3">
          <h1 className="text-5xl font-extrabold leading-[.95]">{t('Something went wrong')}</h1>
          <p className="text-mute">{t('Your check-ins are safe. Reload the page. If it keeps happening, tell your sponsor teacher what you were doing.')}</p>
          <div className="flex gap-2">
            <button className="min-h-[44px] px-4 rounded-md bg-brand text-brand-ink font-bold" onClick={() => location.reload()}>{t('Reload')}</button>
            <a className="min-h-[44px] px-4 rounded-md border border-line font-bold grid place-items-center" href="/">{t('Go home')}</a>
          </div>
        </div>
      </div>
    )
  }
}
