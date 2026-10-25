import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Icon } from '@/components/ui/Icon'

interface ToastItem { id: number; text: string; tone: 'ok' | 'warn' | 'bad' | 'info' }
const Ctx = createContext<(text: string, tone?: ToastItem['tone']) => void>(() => {})
export const useToast = () => useContext(Ctx)

/** Toasts reuse the verb of the action ("Saved", "Approved") so the vocabulary stays consistent. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const push = useCallback((text: string, tone: ToastItem['tone'] = 'ok') => {
    const id = Date.now() + Math.random()
    setItems(x => [...x, { id, text, tone }])
    setTimeout(() => setItems(x => x.filter(i => i.id !== id)), 3800)
  }, [])
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="fixed z-[60] left-0 right-0 bottom-20 sm:bottom-6 flex flex-col items-center gap-2 pointer-events-none px-4" aria-live="polite">
        <AnimatePresence>
          {items.map(i => (
            <motion.div key={i.id} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}
              className="pointer-events-auto flex items-center gap-2 rounded-sign bg-ink text-ground px-4 py-2.5 font-bold shadow-lg">
              <Icon name={i.tone === 'ok' ? 'check' : i.tone === 'info' ? 'info' : 'warn'} size={18} />{i.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  )
}
