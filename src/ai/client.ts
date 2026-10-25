// Client for /api/gemini. Every call is: timeout → JSON → Zod validation → typed result, or a clear failure.
// Failures are NORMAL (no key on the server, offline, rate limit); callers must always have a non-AI path.
import type { ZodType } from 'zod'
import type { AITask } from './prompts'

export class AIError extends Error {
  constructor(public reason: 'unavailable' | 'timeout' | 'invalid' | 'rate_limited', message: string) { super(message) }
}

export async function callAI<T>(task: AITask, body: { text?: string; imageBase64?: string; mimeType?: string }, schema: ZodType<T, any, any>, timeoutMs = 20000): Promise<T> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const res = await fetch('/api/gemini', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task, ...body }), signal: ctl.signal })
    if (res.status === 429) throw new AIError('rate_limited', 'Too many AI requests. Try again in a minute.')
    if (!res.ok) throw new AIError('unavailable', 'AI is not available right now.')
    let json: unknown
    try { json = await res.json() } catch { throw new AIError('unavailable', 'AI is not available right now.') }
    const parsed = schema.safeParse((json as any)?.result)
    if (!parsed.success) throw new AIError('invalid', 'The AI answer did not look right, so we ignored it.')
    return parsed.data
  } catch (e: any) {
    if (e instanceof AIError) throw e
    if (e?.name === 'AbortError') throw new AIError('timeout', 'The AI took too long.')
    throw new AIError('unavailable', 'AI is not available right now.')
  } finally { clearTimeout(timer) }
}

/** Resize a photo client-side so we never upload a 12 MB camera image (saves bandwidth and free-tier quota). */
export async function fileToBase64(file: File, maxEdge = 1400): Promise<{ imageBase64: string; mimeType: string }> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  const dataUrl = c.toDataURL('image/jpeg', 0.82)
  return { imageBase64: dataUrl.split(',')[1], mimeType: 'image/jpeg' }
}
