// Vercel serverless function. The Gemini key lives ONLY here (process.env.GEMINI_API_KEY), never in the browser.
// The client picks a `task`; the prompt and response schema for that task live on the server, so this endpoint
// cannot be used as a free general-purpose Gemini proxy. Rate limited per IP (best-effort in-memory).
// Runs on the Node runtime; types kept local so the file has no build-time dependency on @vercel/node.

type Req = { method?: string; body?: any; headers: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }
type Res = { status: (n: number) => Res; json: (o: unknown) => void; setHeader: (k: string, v: string) => void }

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 20
const hits = new Map<string, number[]>()

// Keep these in sync with src/ai/prompts.ts (tests/unit/ai.test.ts compares them).
export const SYSTEM: Record<string, string> = {
  schedule: 'You read photos of a high school class schedule. Extract one entry per class period. Use only what is printed. If a field is not visible, use an empty string. Never guess a teacher name. Respond with JSON only.',
  note: 'You write ONE short plain-English sentence or two for a teacher summarizing shuttle attendance. Use ONLY the numbers given in the facts. Never invent a number, never name a student, never say a student was skipping or tardy unless a count says so. Respond with JSON only.',
  timetable: 'You read photos of a school shuttle timetable. Extract each trip: bus number, from stop, to stop, departure and arrival time as printed. Respond with JSON only.',
  ask: 'You answer student questions about the school shuttle using ONLY the provided schedule context. If the answer is not in the context or the question is not about the shuttle or school schedule, say you can only help with shuttle questions and set grounded=false. Be brief. Respond with JSON only.',
  themes: 'You group short pieces of student and teacher feedback about an app into at most 6 themes. For each theme give a short title, how many comments belong to it, and one verbatim example. Do not invent comments. Respond with JSON only.',
}

const S = (type: string, extra: object = {}) => ({ type, ...extra })
const SCHEMA: Record<string, object> = {
  schedule: S('OBJECT', { properties: { entries: S('ARRAY', { items: S('OBJECT', { properties: { period: S('INTEGER'), courseName: S('STRING'), room: S('STRING'), teacherName: S('STRING'), building: S('STRING') }, required: ['period', 'courseName'] }) }) }, required: ['entries'] }),
  note: S('OBJECT', { properties: { note: S('STRING') }, required: ['note'] }),
  timetable: S('OBJECT', { properties: { trips: S('ARRAY', { items: S('OBJECT', { properties: { busNumber: S('STRING'), fromStop: S('STRING'), toStop: S('STRING'), depart: S('STRING'), arrive: S('STRING') }, required: ['busNumber', 'fromStop', 'toStop', 'depart', 'arrive'] }) }) }, required: ['trips'] }),
  ask: S('OBJECT', { properties: { answer: S('STRING'), grounded: S('BOOLEAN') }, required: ['answer', 'grounded'] }),
  themes: S('OBJECT', { properties: { themes: S('ARRAY', { items: S('OBJECT', { properties: { title: S('STRING'), count: S('INTEGER'), example: S('STRING') }, required: ['title', 'count', 'example'] }) }) }, required: ['themes'] }),
}

const TEXT_LIMIT = 6000
const IMAGE_LIMIT = 4_000_000 // base64 chars (~3 MB)

export default async function handler(req: Req, res: Res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const key = process.env.GEMINI_API_KEY
  if (!key) return res.status(503).json({ error: 'AI is not configured' })

  const ip = String(req.headers['x-forwarded-for'] ?? req.socket?.remoteAddress ?? 'unknown').split(',')[0].trim()
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter(t => now - t < WINDOW_MS)
  if (recent.length >= MAX_PER_WINDOW) return res.status(429).json({ error: 'Too many requests' })
  hits.set(ip, [...recent, now])

  const { task, text, imageBase64, mimeType } = req.body ?? {}
  if (!SYSTEM[task]) return res.status(400).json({ error: 'Unknown task' })
  if (typeof text === 'string' && text.length > TEXT_LIMIT) return res.status(413).json({ error: 'Too much text' })
  if (typeof imageBase64 === 'string' && imageBase64.length > IMAGE_LIMIT) return res.status(413).json({ error: 'Image too large' })

  const parts: object[] = []
  if (typeof text === 'string' && text) parts.push({ text })
  if (typeof imageBase64 === 'string' && imageBase64) parts.push({ inlineData: { mimeType: /^image\/(jpeg|png|webp)$/.test(mimeType) ? mimeType : 'image/jpeg', data: imageBase64 } })
  if (!parts.length) return res.status(400).json({ error: 'Nothing to process' })

  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 18_000)
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      signal: ctl.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM[task] }] },
        contents: [{ role: 'user', parts }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA[task], temperature: task === 'note' ? 0.2 : 0 },
      }),
    })
    if (!r.ok) return res.status(502).json({ error: 'Upstream error' })
    const data: any = await r.json()
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text
    let result: unknown
    try { result = JSON.parse(raw) } catch { return res.status(502).json({ error: 'Bad model output' }) }
    return res.status(200).json({ result })
  } catch {
    return res.status(504).json({ error: 'Timed out' })
  } finally { clearTimeout(timer) }
}
