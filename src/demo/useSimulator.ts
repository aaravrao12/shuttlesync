import { useEffect, useRef } from 'react'
import { useCampus, useSettings } from '@/firebase/hooks'
import { getStore } from '@/firebase/store'
import { createSimulator } from './simulator'

const LOCK = 'ss_sim_lock'
const tabId = Math.random().toString(36).slice(2)

/**
 * Mount once at the app root. Runs the demo simulator on THIS device only if this device started it
 * (settings.simulatorOwner) and no other tab on the device holds the heartbeat lock — so events are never duplicated.
 */
export function useSimulatorHost() {
  const settings = useSettings()
  const campus = useCampus()
  const snap = useRef({ buses: campus.buses, runs: campus.runs, stops: campus.stops, settings })
  snap.current = { buses: campus.buses, runs: campus.runs, stops: campus.stops, settings }

  const store = (() => { try { return getStore() } catch { return null } })()
  const mine = !!store && settings.simulatorOn && settings.simulatorOwner === store.uid()

  useEffect(() => {
    if (!mine || !store) return
    const tick = createSimulator(store, () => snap.current)
    // Memory mode can afford 1 Hz; Firestore mode is throttled to protect the free-tier write budget (see DECISIONS.md).
    const every = store.mode === 'memory' ? 1000 : 5000
    let busy = false
    const id = setInterval(async () => {
      try {
        const lock = JSON.parse(localStorage.getItem(LOCK) || 'null')
        if (lock && lock.tab !== tabId && Date.now() - lock.at < every * 3) return // another tab here is the host
        localStorage.setItem(LOCK, JSON.stringify({ tab: tabId, at: Date.now() }))
      } catch { /* no localStorage: just run */ }
      if (busy) return
      busy = true
      try { await tick() } finally { busy = false }
    }, every)
    return () => clearInterval(id)
  }, [mine])
}
