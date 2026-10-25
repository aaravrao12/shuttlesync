# ShuttleSync: Full Build Spec for Claude Code (v2, rubric-optimized)

> Save this in an empty folder as `SPEC.md` and tell Claude Code: "Read SPEC.md and build the whole project, phase by phase." Sections 1 and 2 are for the team (humans); everything else is for Claude Code too, so it understands what the app must prove, not just what it must do.

---

## 0. How to work (read first, Claude Code)

- You are building a hackathon web app for 4 students at **Plano Senior High School** (Plano, TX). Judges are **teachers**. The official prompt is: **"Find a problem at your school, build a solution, and get people to use it."** The last four words matter as much as the code: the app must be usable by real students and teachers in a real pilot, and it must collect the evidence that proves they used it.
- **Build order is non-negotiable (Section 18):** the core loop first (route → QR check-in → live teacher roster), working on real phones, frozen early so the team can pilot it. Only then the "wow" layers (3D, AI extras, admin wizard). A beautiful app nobody tested scores worse than a solid app 30 real students used.
- **Use every relevant skill and tool you have.** Before writing any UI, load and follow your frontend/design skills (e.g. `frontend-design`) and any 3D/animation guidance. Use them throughout.
- After every phase: run the app, fix all errors and warnings, and visually check every screen at 1440px and 390px with a browser/screenshot tool if you have one. Test on a real phone-sized viewport with touch.
- **The team must be able to explain every part.** For every module you write, keep the code readable, comment the "why" (not the "what"), and update `docs/HOW-IT-WORKS.md` (Section 13). Prefer simple, explainable algorithms over clever ones.
- Ambiguity → choose what a top product designer would choose, log it in `DECISIONS.md` with the reason (judges score "design decisions").
- **Never fabricate data or stats anywhere in the app.** Any number shown as a real result must come from the Evidence store (Section 11). Placeholders must be visibly labeled `[REPLACE WITH SURVEY DATA]` until the team fills them in. Simulated demo data must be labeled "Simulated" in the UI.
- **Budget: $0.** Free tiers only.

---

## 1. Rubric map (why each part exists)

Every feature must earn points. This table is the source of truth for priorities.

| Rubric category (pts) | What gets max points | Where in this spec |
|---|---|---|
| Problem & Impact (20) | A specific, **measured** problem; named users (students, teachers, attendance office); quantified impact (tardies, minutes lost, teacher time) | §2 Evidence Plan Phase 0, §3, Results page §10.14 |
| Functionality & UX (20) | Core loop works reliably live; a **brand-new user** finishes the main task without help; fallbacks when GPS/Wi-Fi fail | §8 core logic, §10 screens, §14 demo + fallbacks, first-time-user test §2 |
| User Testing & Validation (20) | Multiple relevant users, realistic setting (real stops/buses), measured results, **"users said X → we changed Y"** with before/after numbers | §2 Phases 2–4, §11 built-in instrumentation + Results page |
| Creativity (15) | Fresh, thoughtful adaptation to *this* school: fairness framing, "unverified ≠ guilty," teacher-first AI, construction-specific wayfinding, 3D campus story | §4 product principles, §8.4–8.5, §9, §15 |
| Technical Execution (15) | Sensible choices with reasons, integration (real-time sync, geofencing, AI with validation), tests, iteration, **every member explains their module** | §6 stack + reasons, §8 + tests, §12 ownership, §13 docs |
| Presentation (10) | Story → data → live demo → testing results → what we learned | §14 pitch structure + demo script |

---

## 2. Evidence Plan (for the team — this is 40+ points, start before code)

The judges will ask: "Did you ask anyone? Did anyone actually use it? What did you change?" This section makes the answer yes, yes, and here's the list.

### Owners
- **Evidence lead:** one teammate owns the survey, interview notes, pilot schedule, and the Evidence store. Everyone helps recruit.
- Every claim on a slide must trace to a row in the Evidence store or a dated note.

### Phase 0 — Prove the problem (days 1–3, before more code)
1. **Permission first.** Show the sponsor teacher a one-page plan: what we collect (bus location, scan time, location only at the moment of a scan), who sees it, how long we keep it. Ask what approval is needed (sponsor, principal/AP, attendance office). Get it in writing (an email is fine). No pilot with real students' data without it.
2. **Student survey** (Google Form, ~7 questions, anonymous, ~2 min). Target **60+ responses**; push via homeroom/advisory, club group chats, the sponsor teacher's email. Suggested questions:
   - How many times per week do you ride a shuttle between buildings? (0 / 1–2 / 3–5 / 6+)
   - In the last month, how many times did a late shuttle make you late to class? (0 / 1 / 2–3 / 4+)
   - Were you ever marked tardy or absent because the shuttle was late? (Yes / No / Not sure)
   - How do you currently find out which shuttle to take? (multiple choice + other)
   - How confident are you about which bus goes where? (1–5)
   - Would you scan a QR code when boarding if it guaranteed you wouldn't be marked tardy for a late bus? (Yes / Maybe / No)
   - Preferred language for the app? (English / Spanish / Other / no preference)
3. **Interviews** (10 min each, take notes, ask permission to quote): **3+ students, 2+ teachers who receive shuttle riders, 1 attendance-office staff or AP.** Ask teachers: how do you handle "the bus was late" today? How much time does it take? Have you had to change a tardy after the fact?
4. **Ride-along:** one teammate rides/observes the shuttles for 2–3 days and logs scheduled vs. actual departure/arrival times (a simple sheet). This gives a **real average delay** number.
5. **Decide with the data.** If the data shows the biggest pain is "nobody knows which bus" rather than "late buses," shift emphasis to wayfinding (the app supports both — only the pitch and home screen priority change). Log the decision in `DECISIONS.md`. Judges love "the data changed our plan."

### Phase 1 — Build and freeze the core loop (days 3–8)
Claude Code builds Tier 1 (phases 1–5) of §18. **Code freeze for the core loop** before Phase 2 testing starts; afterward only fixes from testing feedback.

### Phase 2 — First-time-user tests (usability, ~day 8)
- **6–10 students + 2 teachers** who have never seen the app. Give a task script; don't help:
  - Student: "Open the link, set up your schedule, find out which bus you take after period 3, and check in on the bus."
  - Teacher: "Open the dashboard. Which of your students are on their way? Who never boarded? Approve attendance."
- The app's **Test Mode** (§11) times each task automatically and records success/failure and where people got stuck.
- After each test: 3-question exit survey in-app (ease 1–5, would you use it 1–5, one thing to change) and optionally the **SUS** (10-question standard usability score).

### Phase 3 — Real pilot (realistic setting, ~days 9–14)
- **One route, one or two transition periods, 15–30 real students, 2–3 receiving teachers, real buses and stops**, for 3–5 school days.
- **Bus phone:** a teammate or student volunteer who already rides that shuttle carries the bus phone (not the driver). Clearly a passenger device.
- **Students without a smartphone or with a dead phone:** a teammate/monitor runs **Stop Kiosk mode** (§10.8b) on one phone/tablet at the stop, and teachers can mark manually. Nobody is excluded.
- Everything is logged automatically (§11): scans, verification rate, GPS accuracy, bus delays, excused-tardy events, teacher overrides, dashboard opens.
- **Baseline vs. pilot:** compare against the ride-along and survey baseline (e.g. "students reported X late-bus tardies/month; during the pilot, Y late-bus arrivals were auto-excused and 0 students were wrongly marked tardy").
- **Fallback if a real-bus pilot is blocked:** run a **realistic walk-through test** — real students walk the actual route between buildings at a real transition time while a teammate carries the bus phone along the shuttle path. Be honest in the pitch about which kind of test it was.

### Phase 4 — Iterate and re-test (days 12–16)
- Fix the top 3 problems from Phases 2–3. Re-run the same task script with **new** users. Report before/after (task success %, median time, scan success %, ease score).
- Log every change in the in-app **Changelog** (§11): `date · what users said/did · what we changed · result after`.

### What to bring to judging
- Survey stats, interview quotes (with permission), ride-along delay data, pilot numbers, before/after table, changelog, and 1–2 signed/emailed quotes from a teacher or admin ("I'd want to keep using this").

---

## 3. The problem (fill in with Phase 0 data)

Plano Senior High is under construction, so students take **shuttle buses between four buildings (A, B, C, D)** during the school day.

**Who experiences it:**
- **Students** — unsure which shuttle to take; marked tardy/absent when the bus is late; no way to prove they were on it.
- **Teachers** — interrupted by "the bus was late" every period; manual tardy corrections; no visibility into who's in transit vs. skipping.
- **Attendance office** — after-the-fact tardy disputes and corrections.

**Why it matters:** unfair tardies affect students' records and stress; teacher time lost to sorting it out; safety — the school can't see whether a student who left Building A reached Building C.

**Evidence (fill in):** `[REPLACE WITH SURVEY DATA: X% of N students marked tardy because of a shuttle]`, `[average shuttle delay from ride-along]`, `[teacher quote]`, `[attendance office quote]`.

**Scales beyond Plano Senior:** any school that buses students between buildings during the day — construction relocations, career/technical centers, dual-credit runs, field trips. The Admin setup makes buildings and routes configurable.

---

## 4. The product

**ShuttleSync — "If the bus is late, the student isn't."**

1. **Student app** — which shuttle to catch each period (bus, stop, departure, arrival building/room, countdown); **scan a QR when boarding**.
2. **Bus mode** — a passenger phone on each bus shares live GPS (hands-free, tap Start once).
3. **Teacher dashboard** — live map of buses, real-time roster (arrived / on the way / bus late → excused / unverified / never boarded), event feed, AI-written attendance note the teacher approves.
4. **Stop Kiosk mode** — one device at a stop checks in students without phones.
5. **Admin setup** — buildings, stops, routes, schedule, QR sheets; any school can configure it.
6. **Evidence & Results** — built-in test mode, feedback, analytics, and a public Results/Impact page (§11).

**Design principles that make it creative and trustworthy (say these in the pitch):**
- **Fairness first:** the system's job is to *protect* students from unfair tardies, not to catch them.
- **Unverified ≠ guilty:** a failed location check is shown as "unverified — teacher decides," never as an accusation. "Never boarded" only appears after the last possible bus has left, and teachers always have final say.
- **AI assists, teachers decide:** numbers are computed by plain, testable code; AI only writes the plain-English note and reads photos.
- **Location minimalism:** buses are tracked; students are located only at the instant they scan.

---

## 5. Users and roles

| Role | Can do |
|---|---|
| Student | See route plan, get reminders, scan QR to check in, see own status, give feedback |
| Bus device | Broadcast location for one assigned bus; show rotating QR |
| Stop kiosk | Check in students by name/ID search or their QR card at a stop |
| Teacher | Live map, rosters for own periods, events, override attendance, approve AI note |
| Admin | Configure buildings, stops, geofences, buses, routes, bell schedule, QR sheets, enroll students, view Results |
| Team (Test Mode) | Run moderated usability tests, view evidence and analytics |

Auth: **Firebase Anonymous Auth + class join code / role picker**; optional Google sign-in. The demo must work without accounts.

---

## 6. Tech stack (all free) — with the reason for each (put reasons in DECISIONS.md)

- **Vite + React + TypeScript** — fast, typed, everyone can read it.
- **Tailwind CSS** with custom design tokens (not the default palette as the look).
- **Framer Motion** (UI motion), **GSAP** (scroll timelines).
- **Three.js via @react-three/fiber + drei** (3D landing/campus; lazy-loaded, Tier 2).
- **Firebase Spark (free):** Firestore real-time listeners (instant dashboard updates without our own server), Anonymous/Google Auth.
- **Leaflet + react-leaflet + OpenStreetMap / CARTO basemaps** — free maps, no key.
- **QR:** `qrcode` (generate), `@zxing/browser` or `html5-qrcode` (scan).
- **Gemini API** (current cheapest Flash vision model) behind **one Vercel serverless function** `/api/gemini` so the key is never in the browser; simple per-IP rate limit.
- **PWA:** installable, offline shell, Notifications API reminders while installed/open.
- **Vitest** (unit), **Playwright** (end-to-end core loop).

**Free-tier budget:** bus GPS writes throttled to one write every **5–10 s** (and only when moved > 10 m); dashboard reads via listeners, not polling. Document the math in `DECISIONS.md` (e.g. 6 buses × 1 write/8 s × 7 h ≈ 19k writes/day, under the Spark daily write limit — verify the current limit and adjust).

`.env.example`: Firebase config, `GEMINI_API_KEY` (server only).

---

## 7. Data model (Firestore)

TypeScript types for each in `src/types.ts`.

```
schools/{schoolId}                 name, timezone ("America/Chicago"), createdAt
  buildings/{id}                   name, code ("A"), color, lat, lng
  stops/{id}                       name, buildingId, lat, lng, geofenceRadiusM (default 40)
  buses/{id}                       number, label, capacity, routeId, qrSecret,
                                   status: idle|boarding|in_transit|arrived|delayed,
                                   lastLocation {lat,lng,speedMps,heading,accuracyM,updatedAt},
                                   currentStopId, nextStopId, etaToNextStop, delayMinutes
  routes/{id}                      name, stopIds[], color
  trips/{id}                       busId, routeId, period, date, fromStopId, toStopId,
                                   scheduledDepart, scheduledArrive, actualDepart, actualArrive, status
  bellSchedule/{id}                period, name, start, end, transitionStart
  students/{id}                    name, grade, studentNumber, preferredLanguage,
                                   schedule[{period, buildingId, room, teacherId, courseName}]
  teachers/{id}                    name, email, periods[{period, buildingId, room, courseName, studentIds[]}]
  checkins/{id}                    studentId, busId, tripId, scannedAt, method: qr|kiosk|photo|teacher_manual,
                                   studentLocation{lat,lng,accuracyM}?, busLocationAtScan{lat,lng}?,
                                   distanceToBusM?, verified, verifyReason
  events/{id}                      type, busId?, studentId?, stopId?, message, createdAt
  attendance/{date_period_teacher} records{studentId: present|in_transit|excused_bus_late|tardy|absent|unknown},
                                   overrides[{studentId, from, to, by, at}], aiNote, approvedAt
  -- evidence (§11) --
  analytics/{id}                   type, role, sessionId (anonymous), props, createdAt, isPilot, isSimulated
  feedback/{id}                    role, rating, easeScore, wouldUse, text, screen, createdAt, isPilot
  usabilityTests/{id}              participantCode (P01, no names), role, round (1|2), task, success,
                                   durationMs, stuckAt?, notes, createdAt
  susResponses/{id}                participantCode, round, answers[10], score
  changelog/{id}                   date, observation, change, resultAfter, linkedTestIds[]
  baseline/{id}                    source (survey|ride_along|interview), metric, value, n, notes, date
```

**Security rules (`firestore.rules`):** students read only their own doc and write only their own check-ins/feedback; bus devices write only their bus; kiosks create check-ins only for their stop; teachers read their own periods; admins write config; evidence collections readable by admin/team role only, analytics write-only from clients. Reasonable for a hackathon, clearly thought through.

**Retention:** check-ins and student locations auto-purged after 30 days (scheduled cleanup script or admin "purge" button); analytics contain no names.

---

## 8. Core logic (`src/lib/`, every file unit-tested with Vitest, explainable in 30 seconds)

### 8.1 Route planner (`routePlanner.ts`)
For each period transition where the next class is in a different building, choose the trip that departs after the previous class ends and arrives before the next starts (shortest). Output: bus, stop, depart, arrive, walking hint, "leave class by." If none fits: soonest option + "This bus arrives after the bell. Your teacher will be notified automatically."

### 8.2 Geofencing (`geofence.ts`)
Haversine distance; enter at radius, exit at radius × 1.5 (hysteresis); debounced `bus_arrived` / `bus_departed` events.

### 8.3 ETA and delay (`eta.ts`)
ETA = remaining route distance ÷ rolling average speed (clamped). Delayed if ETA > next bell or > 3 min past scheduled departure. Students checked into a delayed bus → `excused_bus_late`. No AI.

### 8.4 Check-in verification (`verifyCheckin.ts`)
QR encodes `{schoolId, busId, token}` where token rotates every 60 s (HMAC of qrSecret + time window) on the bus's QR display; printed QR sheets use a static token and rely on location only. On scan:
1. Token valid for this bus (current or previous window).
2. Student location vs. bus live location: **verified** if distance ≤ max(75 m, combined GPS accuracy) and bus location < 30 s old.
3. Location denied / inaccurate / bus phone offline → **unverified** with a human-readable reason ("Bus phone offline," "GPS too inaccurate indoors"). Never auto-accusing.
4. Duplicate scan for the same trip ignored.
5. Kiosk and teacher-manual check-ins record `method` and who did it.
Track and display the **verification rate and false-flag rate** in Results (a pilot metric).

### 8.5 Status resolver (`studentStatus.ts`)
✅ Arrived · 🟢 On the way (ETA) · 🟡 Bus late — excused · ⚪ No shuttle needed · 🟠 Unverified — teacher decides · 🔴 Not checked in (shown only after the last bus that could get them there has departed; label "Not checked in," not "skipping"). Each status has icon + text + color (never color alone).

### 8.6 Metrics (`metrics.ts`)
Pure functions computing pilot metrics from logged data: scans, verification rate, median check-in time, average bus delay, late-bus tardies auto-excused, teacher overrides, task success %, median task time, SUS score, before/after deltas. These power the Results page and the AI note. Unit-tested.

---

## 9. AI features (Gemini via `/api/gemini`)

Rules: structured JSON output (response schema) validated with **Zod**; graceful fallback if it fails or times out (the app must work fully with AI off); never decides attendance; minimal data sent (student codes instead of names where possible). Prompts in `src/ai/prompts.ts` with example JSON.

1. **Snap your schedule (student onboarding, Tier 1).** Photo of printed schedule → `[{period, courseName, room, teacherName, building}]` → editable confirm screen. Manual entry is always available as a fallback.
2. **AI attendance note (teacher, Tier 1).** Input: the counts and statuses already computed by `studentStatus.ts`/`metrics.ts`. Gemini only writes the sentence ("4 students excused for Bus 14's 9-minute delay; 1 not checked in — consider following up."). Every number in the note must match the computed counts; the app checks this and falls back to a template sentence if not. Teacher approves with one click.
3. **Snap the shuttle timetable (admin, Tier 2).** Photo → trips → preview → import.
4. **Ask ShuttleSync (student, Tier 2).** Grounded only in the school's route/schedule data; refuses off-topic.
5. **Feedback summarizer (team, Tier 2).** Clusters free-text feedback into top themes for the changelog. This is a genuine "AI helped us iterate" story.

---

## 10. Screens (all built, beautiful, responsive)

### Public
1. **Landing.** 3D campus hero (Tier 2; static illustrated hero in Tier 1). Headline "If the bus is late, the student isn't." Sections: the problem (pulls real numbers from the Evidence store; shows `[REPLACE…]` until filled), how it works (3 steps), the three experiences, **"How we tested it"** (pulls from Results), privacy promise, "Built at Plano Senior, designed for any school," team (4 members + their module), CTA → demo.
2. **Role picker / sign in.**

### Student (mobile-first, native feel)
3. **Today** — giant next move + countdown ring; day timeline.
4. **Scan** — full-screen scanner, custom frame, haptic, success animation; honest verified/unverified state with the reason.
5. **My Bus** — live mini-map, ETA, "you're excused if this is late" badge.
6. **Onboarding** — snap schedule or enter manually → confirm → route reveal. First-run coach marks (3 max) so a new user never needs help.
7. **Ask** (Tier 2), **Settings** (notifications, EN/ES, large text, privacy info), **Feedback** button on every screen.

### Bus mode
8. **Bus device** — pick bus → Start → big status, wake lock, "passenger device — not for the driver" notice; **QR display mode** (rotating QR full-screen).
8b. **Stop Kiosk** — big search-by-name/ID list for a stop; tap to check in a student without a phone; logs `method: kiosk`.

### Teacher (desktop-first, tablet OK)
9. **Live Dashboard** — map with animated bus markers; roster with status chips and layout animations; counters (Arrived / On the way / Excused / Unverified / Not checked in); event feed; "Write attendance note" → AI note → Approve; one-click manual override with reason.
10. **Bus detail** — trips today, on-time %, students aboard.
11. **Reports** — late buses this week, tardies auto-excused, most-delayed routes, teacher minutes saved (estimate formula shown).

### Admin
12. **Setup wizard** — buildings, stops (drag geofence), buses, routes, bell schedule, timetable photo import (Tier 2), CSV enroll, **print QR sheets**.

### Evidence (see §11)
13. **Test Mode** — moderated usability test runner.
14. **Results / Impact page** — the slide-ready numbers.
15. **Changelog** — "users said X → we changed Y."
16. **How it works** — plain-language explainer of the system for judges (diagram of check-in → verification → roster), linked from the landing page and dashboard.

---

## 11. Built-in evidence & instrumentation (this wins User Testing)

- **Analytics:** a tiny `track(type, props)` helper writes anonymous events (session ID, role, screen, action) to `analytics`, flagged `isPilot` / `isSimulated`. Events: onboarding_started/completed, schedule_photo_used/manual, scan_attempt/success/unverified(reason), kiosk_checkin, teacher_override, dashboard_open, ai_note_generated/approved/edited, error shown. Respect a global "analytics off" switch.
- **Feedback widget:** floating button → 1–5 ease, would-use, one text box, auto-tags the screen.
- **Test Mode** (team-only route `/test`): pick participant code (P01…), role, round; shows the task card; one tap start/stop timer; mark success/fail and where they got stuck; then the in-app exit survey and optional SUS. Saves to `usabilityTests` / `susResponses`. No names stored.
- **Baseline entry:** a simple form/CSV import for survey results, interview quotes, and ride-along delay data → `baseline`.
- **Results page** (`/results`): auto-generated, presentation-ready: survey headline stats, average real delay, pilot participants and days, total check-ins, verification rate, late-bus tardies auto-excused, teacher overrides, task success % and median time **round 1 vs round 2**, SUS before/after, top feedback themes, quotes. Every number shows its sample size (n) and source; simulated data is visibly excluded or labeled. Big, clean charts (follow any dataviz skill you have). Export as PDF/print view for a handout.
- **Changelog page:** timeline of changes driven by feedback with before/after metrics.

---

## 12. Team ownership (Technical Execution: every member explains their part)

| Owner | Module | Must be able to explain live |
|---|---|---|
| Teammate 1 | Student app + route planner + schedule photo AI | How the best bus is chosen; how the photo becomes validated JSON |
| Teammate 2 | QR check-in, verification, kiosk | Rotating token, distance check, why "unverified" isn't "guilty," fallbacks |
| Teammate 3 | Bus mode, geofencing, ETA, Firestore real-time, dashboard | How a bus phone's GPS reaches the teacher's screen; geofence hysteresis; delay rule; free-tier write math |
| Teammate 4 (Evidence lead) | Evidence/Results/Test Mode, AI note, pitch | The testing method, the numbers, what changed; how the AI note is checked against computed counts |

Claude Code: keep module boundaries matching this table so each owner has a clear folder.

---

## 13. Docs that make the team judge-ready

- `README.md` — setup (Firebase project, env vars, Vercel deploy), how to run demo, how to run tests.
- `docs/HOW-IT-WORKS.md` — one section per module (owner, files, plain-English explanation, a small diagram, the key function, edge cases).
- `docs/JUDGE-QA.md` — 25 likely judge questions with short answers (e.g. "What if a student scans and doesn't get on?", "What if the bus phone dies?", "Isn't tracking students creepy?", "What if the AI is wrong?", "How much does it cost?", "How would the district adopt this?", "What did testing change?").
- `DECISIONS.md` — every technical/design choice + reason + alternatives considered.
- `docs/TESTING.md` — the Evidence Plan protocol, task scripts, consent wording, and results tables (auto-filled from Results where possible).

---

## 14. Pitch structure & demo script (Presentation: 10)

Build a `/pitch` page (presenter mode, arrow-key slides, styled like the app) with this flow — about 5 minutes:
1. **Story (20 s):** one real (anonymized, with permission) student moment — late bus, marked tardy.
2. **Data (40 s):** survey %, real average delay, teacher/attendance quote. Who's affected.
3. **Solution (20 s):** one sentence + the three experiences.
4. **Live demo (2 min):**
   1. Student sets up schedule (photo → route).
   2. Teammates — **and a judge** — scan the Bus 14 QR on their own phones → names turn green on the projector live.
   3. One person doesn't scan → stays "Not checked in" after the bus leaves.
   4. "Make Bus 14 late" → students flip to "Bus late — excused."
   5. Teammate with the bus phone walks into the C-building zone → "Bus 14 arrived at C."
   6. "Write attendance note" → AI note → Approve.
5. **Testing & results (60 s):** pilot numbers, round 1 → round 2 improvements, the changelog's top 3 changes, a teacher quote.
6. **Design decisions (20 s):** fairness first, unverified ≠ guilty, AI assists / teachers decide, location minimalism.
7. **Close:** "If the bus is late, the student isn't." Next steps: who would run it next semester (offer a handoff plan to the admin).

**Demo safety:** demo mode with simulated buses (labeled "Simulated"), real-phone bus override, room-sized geofence, offline in-memory fallback if Firebase is unreachable, and a pre-recorded backup video of the full flow.

---

## 15. Design direction (NO AI slop)

### Forbidden
Purple-blue gradients on white, glassmorphism everywhere, glowing blobs, Inter-everything with weak hierarchy, emoji as icons, stock dashboard-template grids, lorem ipsum, 3D that has nothing to do with the product, motion without purpose.

### Visual identity
- **Concept:** transit wayfinding signage meets school spirit. Bold, legible, color-coded routes. Building colors (e.g. A deep red, B amber, C teal, D cobalt; tune for contrast). Plano Senior maroon as brand accent.
- **Type:** distinctive display grotesk for headings and big numerals, readable text face, tabular/monospace figures for times. Google Fonts. Huge numerals for countdowns/ETAs.
- **Tokens** as CSS variables on `:root`, full **dark mode**.
- **Layout:** asymmetric grid, generous whitespace on marketing, dense-but-calm dashboard, realistic content.
- **Icons:** one set (Lucide or Phosphor) + custom SVG bus/building icons.
- **Details:** subtle grain, route-line motifs connecting sections, signage labels ("PLATFORM A," "BUS 14 → C"), numbers that tick smoothly.

### 3D (Tier 2, react-three-fiber)
Stylized low-poly isometric 4-building campus with signage colors, roads, a construction zone with cones/barriers, little buses driving routes. Scroll-driven camera follows one bus A → C while copy explains the steps; on arrival a student icon pops to ✅. Procedural geometry only. Optional "3D campus view" toggle on the dashboard using live bus positions. Performance: lazy-load, cap DPR, instancing, pause off-screen, static fallback for low-end devices and reduced motion.

### Motion
Purposeful: page transitions, roster layout animations, status chips morphing, countdown rings, rolling numbers, feed items sliding in, check-in celebration, map markers interpolating between GPS points. Spring physics. Respect `prefers-reduced-motion`.

### Quality bar
WCAG AA, keyboard nav, focus rings, aria labels, icon + text statuses, 360–1920px with no horizontal scroll, designed empty/loading/error states, **EN/ES** (priority set by the survey's language question; keep the toggle regardless).

---

## 16. Privacy & safety

- Student location read **only at the moment of a scan**; buses are tracked, not people.
- Only that school's teachers/admins see check-ins; students see only their own.
- Consent screen on first use explains what's collected in plain language (EN/ES).
- Minimal data to AI; no names where avoidable; nothing sold or reused.
- 30-day auto-purge of check-ins and locations.
- Bus phone is a passenger device; never the driver's.
- In-app **Privacy page**, FERPA-minded design; written approval from school staff before the pilot.

---

## 17. Project structure

```
shuttlesync/
  api/gemini.ts
  public/
  src/
    app/ pages/{landing,auth,student,bus,kiosk,teacher,admin,evidence,pitch,demo}
    components/{ui,map,three,roster,qr,charts,evidence}
    lib/{routePlanner,geofence,eta,verifyCheckin,studentStatus,metrics,time}.ts
    ai/{prompts,client,schemas}.ts
    evidence/{track,testMode,results}.ts
    firebase/{config,hooks,seed}.ts
    demo/{simulator,seedData}.ts
    i18n/{en,es}.json
    styles/tokens.css
    types.ts
  tests/{unit,e2e}
  docs/{HOW-IT-WORKS,JUDGE-QA,TESTING}.md
  firestore.rules  .env.example  README.md  DECISIONS.md
```

---

## 18. Build phases (Claude Code follows in order)

**Tier 1 — must ship before user testing (core loop + evidence):**
1. **Foundation:** scaffold, tokens, fonts, dark mode, design-system components, router, layouts.
2. **Data + core logic:** types, Firebase, seed data, offline in-memory fallback, bus simulator, all `lib/` modules with passing Vitest tests.
3. **Core loop:** student Today/route/scan, bus mode + QR display, kiosk, teacher dashboard (map, roster, feed, overrides). Playwright e2e test: student scans → teacher sees green.
4. **Evidence:** analytics `track`, feedback widget, Test Mode, baseline entry, Results page, Changelog, consent screen, privacy page. Schedule-photo AI + AI attendance note with validation and fallbacks.
5. **Real-device hardening:** test on actual phones, GPS inaccuracy handling, offline/poor Wi-Fi states, first-run coach marks. → **CORE FREEZE** (team starts Phase 2 testing).

**Tier 2 — after the freeze, while the pilot runs:**
6. Landing page with 3D campus + scroll story; "How we tested it" section.
7. Admin setup wizard, QR print sheets, Reports, timetable photo AI, Ask ShuttleSync, feedback summarizer.
8. `/pitch` presenter page, How it works page.

**Tier 3 — polish:**
9. Motion pass, EN/ES completeness, accessibility audit, Lighthouse 90+ on landing, every screen checked at 390px and 1440px.
10. Docs: README, HOW-IT-WORKS, JUDGE-QA, TESTING, DECISIONS. Final Playwright run.

Feedback from testing always takes priority over Tier 2/3 work.

---

## 19. Definition of done

- `npm run dev` works from a clean clone via the README; `npm run build`, `npm test`, and the Playwright e2e pass.
- The core loop works on real phones with real GPS, and with Firebase offline (demo fallback).
- A first-time user completes the student and teacher tasks without help.
- Test Mode, feedback, analytics, baseline entry, Results, and Changelog all work and show real (non-simulated) data separately from demo data.
- No fabricated statistics anywhere; placeholders clearly marked.
- The Gemini key never appears client-side; the app works with AI disabled.
- Every screen is responsive, animated with purpose, light/dark themed, EN/ES.
- `docs/HOW-IT-WORKS.md` and `docs/JUDGE-QA.md` let each teammate explain their module.
- It looks like a real, funded product, not a template.
