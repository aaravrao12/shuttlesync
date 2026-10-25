// The data layer. ONE small interface, two implementations:
//   • MemoryStore  — localStorage-backed, syncs between tabs of the same browser. Used for the offline demo
//                    and as the automatic fallback when Firebase is unreachable.
//   • FirestoreStore — real-time listeners, so the teacher's screen updates the moment a student scans.
// Everything above this file (hooks, pages, simulator) is written against `Store` only.
import { SCHOOL_ID, firebaseConfig, firebaseConfigured, forcedOffline } from './config'

export type Unsub = () => void
export type Doc<T> = T & { id: string }

export interface Store {
  mode: 'memory' | 'firestore'
  /** why we are in memory mode when Firebase was expected */
  fallbackReason: string | null
  watchCollection<T = any>(coll: string, cb: (rows: Doc<T>[]) => void): Unsub
  watchDoc<T = any>(coll: string, id: string, cb: (row: Doc<T> | null) => void): Unsub
  get<T = any>(coll: string, id: string): Promise<Doc<T> | null>
  set(coll: string, id: string, data: object): Promise<void>
  /** merge top-level fields; creates the doc if missing */
  update(coll: string, id: string, patch: object): Promise<void>
  add(coll: string, data: object): Promise<string>
  remove(coll: string, id: string): Promise<void>
  /** delete every doc in a collection (admin purge / demo reset) */
  clear(coll: string): Promise<void>
  uid(): string
}

const clean = (o: any) => JSON.parse(JSON.stringify(o, (_k, v) => (v === undefined ? null : v)))
const newId = () => (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 20) : Math.random().toString(36).slice(2, 12) + Date.now().toString(36))

// ---------------------------------------------------------------------------------------------
class MemoryStore implements Store {
  mode = 'memory' as const
  fallbackReason: string | null
  private cache = new Map<string, Record<string, any>>()
  private subs = new Map<string, Set<() => void>>()
  private userId: string
  constructor(reason: string | null) {
    this.fallbackReason = reason
    this.userId = this.loadUid()
    // Another tab wrote to localStorage → reload that collection and notify our listeners.
    window.addEventListener('storage', e => {
      if (!e.key || !e.key.startsWith(this.prefix())) return
      const coll = e.key.slice(this.prefix().length)
      this.cache.delete(coll)
      this.notify(coll)
    })
  }
  private prefix = () => `ss:v1:${SCHOOL_ID}:`
  private loadUid() {
    try {
      let u = localStorage.getItem('ss_uid')
      if (!u) { u = 'local-' + newId(); localStorage.setItem('ss_uid', u) }
      return u
    } catch { return 'local-' + newId() }
  }
  uid() { return this.userId }
  private load(coll: string): Record<string, any> {
    let m = this.cache.get(coll)
    if (!m) {
      try { m = JSON.parse(localStorage.getItem(this.prefix() + coll) || '{}') } catch { m = {} }
      this.cache.set(coll, m!)
    }
    return m!
  }
  private persist(coll: string) {
    try { localStorage.setItem(this.prefix() + coll, JSON.stringify(this.cache.get(coll) ?? {})) }
    catch { /* quota exceeded: keep working from memory */ }
  }
  private notify(coll: string) { this.subs.get(coll)?.forEach(f => f()) }
  private rows<T>(coll: string): Doc<T>[] { return Object.entries(this.load(coll)).map(([id, d]) => ({ ...d, id })) as Doc<T>[] }

  watchCollection<T>(coll: string, cb: (rows: Doc<T>[]) => void): Unsub {
    const fire = () => cb(this.rows<T>(coll))
    if (!this.subs.has(coll)) this.subs.set(coll, new Set())
    this.subs.get(coll)!.add(fire)
    queueMicrotask(fire)
    return () => { this.subs.get(coll)?.delete(fire) }
  }
  watchDoc<T>(coll: string, id: string, cb: (row: Doc<T> | null) => void): Unsub {
    const fire = () => { const d = this.load(coll)[id]; cb(d ? ({ ...d, id } as Doc<T>) : null) }
    if (!this.subs.has(coll)) this.subs.set(coll, new Set())
    this.subs.get(coll)!.add(fire)
    queueMicrotask(fire)
    return () => { this.subs.get(coll)?.delete(fire) }
  }
  async get<T>(coll: string, id: string) { const d = this.load(coll)[id]; return d ? ({ ...d, id } as Doc<T>) : null }
  async set(coll: string, id: string, data: object) { this.load(coll)[id] = clean(data); this.persist(coll); this.notify(coll) }
  async update(coll: string, id: string, patch: object) {
    const m = this.load(coll)
    m[id] = { ...(m[id] ?? {}), ...clean(patch) }
    this.persist(coll); this.notify(coll)
  }
  async add(coll: string, data: object) { const id = newId(); await this.set(coll, id, data); return id }
  async remove(coll: string, id: string) { delete this.load(coll)[id]; this.persist(coll); this.notify(coll) }
  async clear(coll: string) { this.cache.set(coll, {}); this.persist(coll); this.notify(coll) }
}

// ---------------------------------------------------------------------------------------------
async function makeFirestoreStore(): Promise<Store> {
  const [{ initializeApp }, fs, { getAuth, signInAnonymously }] = await Promise.all([
    import('firebase/app'), import('firebase/firestore'), import('firebase/auth'),
  ])
  const app = initializeApp(firebaseConfig as any)
  const db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache({}), ignoreUndefinedProperties: true })
  const auth = getAuth(app)
  let uid = ''
  try { uid = (await signInAnonymously(auth)).user.uid } catch { uid = 'anon-' + newId() }

  const col = (c: string) => fs.collection(db, 'schools', SCHOOL_ID, c)
  const ref = (c: string, id: string) => fs.doc(db, 'schools', SCHOOL_ID, c, id)

  // Prove we can actually reach the server before committing to it (otherwise fall back to memory).
  await Promise.race([
    fs.getDocFromServer(ref('settings', 'main')).catch(e => { if (e?.code === 'unavailable') throw e }),
    new Promise((_, rej) => setTimeout(() => rej(new Error('Firebase timed out')), 5000)),
  ])

  const s: Store = {
    mode: 'firestore',
    fallbackReason: null,
    uid: () => uid,
    watchCollection(c, cb) { return fs.onSnapshot(col(c), snap => cb(snap.docs.map(d => ({ ...d.data(), id: d.id }) as any)), () => cb([])) },
    watchDoc(c, id, cb) { return fs.onSnapshot(ref(c, id), snap => cb(snap.exists() ? ({ ...snap.data(), id: snap.id } as any) : null), () => cb(null)) },
    async get(c, id) { const d = await fs.getDoc(ref(c, id)); return d.exists() ? ({ ...d.data(), id: d.id } as any) : null },
    async set(c, id, data) { await fs.setDoc(ref(c, id), clean(data)) },
    async update(c, id, patch) { await fs.setDoc(ref(c, id), clean(patch), { merge: true }) },
    async add(c, data) { const r = await fs.addDoc(col(c), clean(data)); return r.id },
    async remove(c, id) { await fs.deleteDoc(ref(c, id)) },
    async clear(c) {
      const snap = await fs.getDocs(col(c))
      for (let i = 0; i < snap.docs.length; i += 400) {
        const b = fs.writeBatch(db)
        snap.docs.slice(i, i + 400).forEach(d => b.delete(d.ref))
        await b.commit()
      }
    },
  }
  return s
}

// ---------------------------------------------------------------------------------------------
let current: Store | null = null
let booting: Promise<Store> | null = null

export function getStore(): Store {
  if (!current) throw new Error('Store not initialized. Call initStore() before rendering.')
  return current
}

export function initStore(): Promise<Store> {
  if (booting) return booting
  booting = (async () => {
    if (!firebaseConfigured) current = new MemoryStore(null)
    else if (forcedOffline()) current = new MemoryStore('Offline demo mode was switched on for this device.')
    else {
      try { current = await makeFirestoreStore() }
      catch (e: any) { current = new MemoryStore(`Could not reach Firebase (${e?.message ?? 'unknown'}). Running offline: data stays on this device.`) }
    }
    return current
  })()
  return booting
}

/** Test seam: lets unit tests inject a store. */
export function _setStoreForTests(s: Store) { current = s }
export { MemoryStore }
