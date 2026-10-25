# Decisions

Format: **choice**, why, what we rejected. Judges score design decisions, so these are written to be said out loud.

## We learned how the shuttle really works, so we changed the product (read this first)
**Original assumption (v1):** students needed help *picking a bus*: a timetable of buses between four buildings A–D, a route planner ("take Bus 14, leave class by 9:58"), and lateness measured against scheduled arrival times.

**What we learned (from the team's walkthrough of the real setup):** Plano Senior runs **one continuous shuttle loop between the Building A loop and the Building H loop (the Annex)**. There is **no timetable and no choice of bus**: any shuttle at your stop goes to the other end. Buildings A, D and E are one zone (D and E have no stop; students walk indoors to the A loop), H is the annex across the road, B and C are closed for construction, and a rain-only stop by the pond serves D and E.

**What we changed:** removed bus-picking, scheduled trips, the route planner and "leave class by" picks. The student home screen is now a **live shuttle tracker** with **"Will I make it?"** (on track / cutting it close / likely late), and tardies are **fair because they are measured from each rider's own ride**, not from a timetable that does not exist. (Logged in the in-app Changelog as well.)

**What we did not change:** the fairness principles, QR check-in, the verification rules, the teacher-decides rule, the privacy model, the offline-first store, or the AI guardrails.

### New rules (all admin-configurable except where noted)
- **A "run" is one one-way trip** (A→H or H→A), detected from the shuttle phone's own GPS: it *opens* (boarding) when the shuttle enters a stop's geofence, *starts* when it leaves, and *ends* when it enters a stop at the other end (which immediately opens the next boarding run). Run ids are deterministic (`date_shuttle_seq`) so two devices cannot create duplicates.
- **Zone hop:** if the shuttle leaves a stop and next enters another stop *in the same zone* (A loop → rain stop), that was a reposition, not a run; the run goes back to boarding.
- **Excused for a slow ride** if the rider's ride (scan → arrival) exceeds **normal ride (default 5 min) + threshold (default 3 min)**, **or** the shuttle reaches the other end **after their class bell**. The same rule runs on a *projected* arrival, so "excused" appears before the shuttle arrives. Unverified check-ins are never auto-excused. Teachers still have the final say.
- **Will I make it?** slack = (bell − now) − (max(walk to stop, shuttle ETA) + normal ride + walk to class). ≥ 3 min on track; 0–3 cutting it close; < 0 likely late ("you are excused if the shuttle is slow"); no shuttle signal → "unknown" (we never guess).
- **"Not checked in" now means "the class bell has rung and there is no check-in."** With no timetable there is no "the last bus has left" moment, so the bell is the fair cutoff; before it the label is "Hasn't boarded yet".
- **Rain stop** is off by default. When an admin turns it on it serves D and E, appears on the map, and counts as a stop in the main zone.

## Product and fairness
- **"Unverified" never means "guilty".** A failed location check records `verified:false` with a human reason and shows "teacher decides". *Rejected:* auto-marking tardy on failed verification; it would punish students for a dead GPS and is exactly the unfairness the app exists to prevent.
- **"Not checked in" appears only after the class bell has rung** (there is no timetable, so "the last bus has left" no longer exists). Before that it says "Hasn't boarded yet".
- **Auto-excuse only for *verified* check-ins on a slow ride.** Unverified ones stay for a human. Slightly less automation, much more trust.
- **Teachers always win.** Overrides carry who, why and when, and beat every computed status.
- **AI never decides anything.** Numbers come from `lib/`. AI reads schedule photos and writes one sentence; the sentence is checked (`validateNote`) and replaced by a template if any number differs. Every AI path has a non-AI fallback.
- **Location minimalism.** Only buses are tracked (and only inside trip windows). A student's location is read once, at the scan, stored on the check-in, and purged after 30 days.

## Logic
- **Needs the shuttle?** Only if the next class is in the other zone (main ↔ annex). Same zone (A/D/E) → "No shuttle needed: walk indoors". Closed buildings have no classes and no stops.
- **Which stop?** The zone's primary stop; with the rain stop on, D and E students use the rain stop.
- **ETA to board.** At my stop → 0. Waiting at the other end → rest of its wait + a normal ride. Heading to my end → rest of the ride (distance ÷ recent speed, or the speed implied by the normal ride). Heading away → reach the far stop, wait, ride back.
- **Geofence: enter at R, leave at 1.5 R, plus a debounce.** Stops GPS wobble from flickering arrived/left events.
- **Dispatch heads-up.** A shuttle phone can report "+5/+10 min" (stuck/slow) so riders are protected immediately; the demo's "Make shuttle slow" uses the same field.
- **Verification = token + distance + freshness.** Rotating HMAC token (60 s window, previous window accepted) so a screenshot expires; allowed distance = max(75 m, combined GPS accuracy); the shuttle fix must be < 30 s old. **Known limit:** on the free tier the shuttle secret is readable by clients, so a determined student could forge a token; the distance check still applies and teachers see every scan. A production version moves verification to a Cloud Function.
- **Two clocks.** School-day math uses "school minutes" from a demo-shiftable clock; token windows and GPS freshness use the real clock.

## Architecture
- **Vite + React + TypeScript + Tailwind.** Fast, typed, everyone can read it. *Rejected:* Next.js (SSR unnecessary; more to explain).
- **One `Store` interface, two implementations** (localStorage + cross-tab sync, and Firestore). The whole UI is written against the interface, so the offline demo exercises the same code as production, and Firebase failure auto-falls back.
- **Firestore real-time listeners** instead of our own server: the teacher's roster updates the moment a student scans, at $0.
- **Simulator uses the real `processBusFix`.** Demo run detection, ETA and delay are produced by the real logic; only the GPS is faked. The simulated shuttles loop A⇄H continuously with a short wait at each end.
- **Gemini behind one Vercel function** that owns the prompts and response schemas per task (so it is not an open proxy), with per-IP rate limiting and size limits. Responses validated with Zod.
- **Roster is computed from students' schedules** (`teacherId` + period) rather than stored on teachers, so students never need write access to teacher documents.
- **Staff PIN is client-side; Firestore rules are the real gate** (staff = documents in `/staff/{uid}`). Honest about it in the UI and README.
- **English-as-key i18n** with a test that fails if any student/teacher/public string lacks Spanish. Team-only tools (Test Mode, Baseline, Pitch, Demo, Setup) are English only; they are used by the four-person team.
- **Manual retention purge**, not Firestore TTL: managed TTL deletes are not part of the free tier. The purge runs whenever staff open the app and has a button in Admin.

## Free-tier budget (verified)
Spark plan quota: **20,000 document writes/day and 50,000 reads/day** ([Firebase pricing](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans), [Firestore quotas](https://docs.cloud.google.com/firestore/quotas)). Checked when this was written; re-check before the pilot.
- **Writes.** Shuttle phones write at most once per 10 s, only when moved > 10 m or every 20 s (keeps the 30 s scan-freshness rule satisfied), and **only around passing periods** (3 min before a class ends to 6 min after the next starts, plus a margin before/after school), unless the carrier chooses "Share all day". About 200 active minutes/day × 3–6 writes/min ≈ 600–1,200 writes per shuttle per day, so two shuttles ≈ **1,200–2,400/day**, plus a few hundred check-ins, run updates and events: far under 20,000.
- **Reads (the tighter limit).** Every document change is billed once per listening client. Per passing period each listener receives ~2 shuttles × 23 min × ~4 updates/min ≈ 180 reads; six passing periods ≈ 1,100 reads/day per listener, plus check-in/event traffic. A pilot of 30 students + 3 teachers with the app open all day lands around **35,000–45,000**: close to the cap. **Pilot guidance:** keep to 1–2 passing periods and close the app between them. *Next step if it scales:* a separate `busLive` collection that only live screens subscribe to.
- **If the quota is exceeded**, Spark shuts the product off for the period; the app falls back to offline demo mode on next load. Use the offline demo for the pitch and keep a recorded backup video.

## Design
- **Concept: transit wayfinding signage meets school spirit.** Building letters as platform signs (A, D, E, H; hazard stripes for the closed B and C); school-bus yellow for the one "next move" sign (the single memorable element); Plano maroon as the brand accent.
- **Type:** Barlow Condensed (highway-signage ancestry) for headings and numerals, Public Sans for text; both bundled, so they work offline. *Rejected:* Inter-everything.
- **Color tokens** are tuned and tested: all text/chip colors pass WCAG AA on every surface in light and dark (axe in CI). Status = icon + words + color, never color alone.
- **Hero film (replaced the procedural 3D scene):** two clips generated with Higgsfield (nano_banana_pro keyframes → Grok Video 1.5 at 720p; Seedance needs a Plus plan) are cut into 73 WebP frames each (≈9 MB total, loaded progressively) and scrubbed on a `<canvas>` by scroll, with Lenis smooth scroll on that page only. Live UI cards (the "Will I make it?" verdict, a roster, the slow-ride rule) are scripted by scroll progress. Desktop with motion allowed only; phones, reduced motion and data-saver get one ≈100 KB poster. Labeled on the page as an AI-generated illustration, not footage of the real campus. Cost: about 58 Higgsfield credits.
- **Charts:** Round 1 vs Round 2 use the validated categorical slots 1–2 (blue/orange), a legend, direct value labels, hover tips and a table view.

## Known limits (be upfront)
- **All coordinates are approximate** (stops from the team's figures, buildings and the rain stop are placeholders) until someone taps "Use this phone's location" at each real spot in Admin. The bell schedule and the 5-min ride / 3-min threshold are placeholders until measured.
- Real-phone behaviour (GPS indoors, iOS camera/wake-lock, battery) must be tested by the team on actual devices (`docs/DEVICE-TEST.md`); automated tests run on desktop Chromium.
- Printed (static) QR codes only prove *which bus*; the location check does the rest.
- Enrolled-by-CSV students claim their record with their student number; without it they appear only via kiosk/teacher marking.
- Gemini model names and free-tier quotas change; both are env/config, not code.
