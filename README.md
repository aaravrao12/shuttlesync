# ShuttleSync

**If the bus is late, the student isn't.**
A web app for Plano Senior High School's construction-era shuttle: one continuous loop between the Building A loop and the Building H loop (the Annex). Students see whether they need it and whether they will make it, and check in by QR; teachers see a live roster; riders on a slow shuttle are excused automatically. Built for the *"Find a problem at your school, build a solution, and get people to use it"* challenge, so it also collects the evidence that people used it.

## Run it (2 minutes, no accounts)

```bash
npm install
npm run dev          # http://localhost:5173
```

With no Firebase keys the app runs **fully offline**: data lives in the browser and syncs between tabs on the same device. That is the demo mode, and it is also the automatic fallback if Firebase is unreachable.

### Demo on one laptop
Open each role in its own tab; `?slot=` gives each tab its own profile:

| Tab | URL | What to do |
|---|---|---|
| Control | `/start?slot=control` → *Load demo campus* → **Demo control** (staff PIN `plano`) | Jump the clock, start the simulator, make a shuttle slow |
| Teacher | `/teacher?slot=teacher` | Unlock, pick *Ms. Rivera* |
| Student | `/start?slot=student` | Pick a simulated student, accept consent |

Everything in demo mode is labeled **Simulated** and is kept out of the Results page.

## Tests

```bash
npm test             # 124 unit tests (Vitest): every lib/ module, AI guardrails, i18n parity, CSV import
npm run test:e2e     # Playwright: core loop, accessibility (axe, light+dark), no-horizontal-scroll 360–1920px
npm run build        # type-check + production build (PWA)
```
First time: `npx playwright install chromium`.

## Set up for real (Firebase + Vercel, all free tiers)

1. **Firebase** → create a project → add a Web app → enable **Firestore** and **Authentication → Anonymous**.
2. Copy `.env.example` to `.env.local` and fill the `VITE_FIREBASE_*` values. Set `VITE_STAFF_PIN` to something only staff know.
3. Deploy `firestore.rules` (`firebase deploy --only firestore:rules`). In the Firestore console, add a document `schools/plano-senior/staff/<your-uid>` with `{ role: "admin" }` for each teacher/admin (your uid is shown in the Firebase Auth user list after you open the app once). **These documents are the real access control**; the in-app PIN is only a speed bump.
4. **Vercel** → import the repo. Add the env vars above plus the **server-only** `GEMINI_API_KEY` (never prefix with `VITE_`). The serverless function is `api/gemini.ts`. Without a key every AI feature falls back to a non-AI path.
5. Open `/admin` (School setup): confirm the two stop locations on site (tap *Use this phone's location* at each; they ship as **approximate**), set the real bell schedule, the number of shuttles, the normal ride time and delay threshold, and the rain-stop toggle; or `/demo` → *Load demo campus*.

## Where things are

```
src/lib/        plain, tested logic: shuttle (needs-shuttle, ETA, will-I-make-it, excused rule), geofence, eta, verifyCheckin, studentStatus, roster, busEngine (run detection), metrics
src/firebase/   store (offline + Firestore behind one interface), hooks, seed
src/demo/       bus simulator + simulated riders (uses the SAME busEngine as a real phone)
src/ai/         prompts, Zod schemas, client, attendance-note guardrail, timetable mapper
src/evidence/   analytics track(), results computation
src/pages/      landing, auth, student, bus, kiosk, teacher, admin, evidence, pitch, demo
api/gemini.ts   the only place the Gemini key exists
docs/           HOW-IT-WORKS, JUDGE-QA, TESTING, DEVICE-TEST
DECISIONS.md    every choice and why
```

## Pilot checklist
1. Written approval from the sponsor/AP (see `docs/TESTING.md`).
2. Demo control → **Real pilot** mode (only now do scans and feedback count as real).
3. Run `docs/DEVICE-TEST.md` on real phones **before** students use it.
4. Enter survey/ride-along data on `/baseline`; run usability tests on `/test`; log changes on `/changelog`; read results on `/results`.

*No fabricated data anywhere: every statistic comes from the Evidence store, and missing data shows `[REPLACE WITH SURVEY DATA]`.*
