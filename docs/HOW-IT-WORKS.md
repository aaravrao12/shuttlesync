# How it works (one section per module, so each teammate can explain theirs)

```
 Student phone            Shuttle phone (passenger)         Teacher screen
 ─────────────            ─────────────────────────         ──────────────
 sees: need the shuttle?  shares GPS (≥10 s, around passing periods)
 "Will I make it?"             │ processBusFix(): geofence → RUN detection → ETA → slow?
 scan QR ───────────────▶ shows rotating QR                  │
    │ one location read        ▼                              ▼
    ▼                    Store (Firestore real-time, or the offline local store) ───▶ buildRoster()
 verifyCheckin                                                                          │
 token ✓ distance ✓ fresh ✓                                                             ▼
 → verified | unverified(reason)                        status chips · counters · feed · AI note (checked) · overrides
```

The campus: the **main campus** (Buildings A, D, E: connected indoors, one stop: the **A loop**) and the **Annex** (Building H, the **H loop**) are joined by ONE continuous shuttle loop. No timetable, no choice of bus: any shuttle at your stop goes to the other end. Buildings B and C are closed. A rain-only stop by the pond serves D and E when an admin switches it on.

---
## 1. Student app, "Will I make it?", schedule-photo AI — *Teammate 1*
**Files:** `src/pages/student/*`, `src/lib/shuttle.ts`, `src/ai/{prompts,schemas,client}.ts`, `src/pages/student/ScheduleEditor.tsx`
**Plain English:** For each passing period, is the next class in the other zone? If not: "No shuttle needed: walk indoors". If so, show the live shuttles, how long until one can be boarded, and a verdict: *on track*, *cutting it close* or *likely late (you are excused if the shuttle is slow)*.
**Key functions:** `shuttleNeed()` (same zone → no), `stopFor()` (D and E use the A loop, or the rain stop when it is on), `etaToBoard()` (where is each shuttle; at my stop = 0; at the far end = rest of its wait + a ride; heading to me = rest of the ride; heading away = far stop + wait + ride back), `willIMakeIt()` (slack = time to the bell − (max(walk to stop, ETA) + normal ride + walk to class)).
**Photo → JSON:** photo is resized in the browser → `/api/gemini` (task `schedule`) → Gemini returns JSON under a response schema → **Zod** validates → mapped onto the editable schedule rows (teacher matched by last name, building by letter) → the student confirms. Manual entry always works.
**Edge cases:** no shuttle signal (we say "waiting for a signal", never guess); free periods; closed buildings (no classes); AI unavailable/garbage (friendly message, manual entry).

## 2. QR check-in, verification, kiosk — *Teammate 2*
**Files:** `src/lib/verifyCheckin.ts`, `src/app/checkin.ts`, `src/pages/student/Scan.tsx`, `src/components/qr/*`, `src/pages/kiosk/Kiosk.tsx`
**Plain English:** The QR carries a token that changes every minute (an HMAC of the shuttle's secret and the minute). On scan we check three things: right shuttle + current token; student's phone near the shuttle phone; shuttle location fresh. All pass → *verified*. Anything fails → *unverified, with the reason in plain words*, never an accusation. The scan attaches to the shuttle's **current run** (the one it is boarding for or already on).
**Key function:** `verifyCheckin()` and `verifyDistance()`; allowed distance = `max(75 m, student accuracy + shuttle accuracy)`.
**Why "unverified ≠ guilty":** a dead GPS or a shuttle phone that lost signal is not the student's fault; a teacher decides and Results counts how often a teacher cleared an unverified scan (the *false-flag rate*).
**Fallbacks:** manual code entry, kiosk at the stop (taps a student onto the shuttle that is boarding), teacher marks manually. Duplicate scans are ignored (deterministic check-in id = student + run).

## 3. Shuttle mode, run detection, geofencing, real-time, dashboard — *Teammate 3*
**Files:** `src/pages/bus/BusDevice.tsx`, `src/lib/{busEngine,geofence,shuttle,roster,studentStatus}.ts`, `src/firebase/*`, `src/pages/teacher/*`, `src/demo/simulator.ts`
**How a shuttle phone's GPS reaches the teacher's screen:** `watchPosition` → throttle (≥10 s; only if moved >10 m or every 20 s; only around passing periods) → `processBusFix()` → writes the shuttle doc + the **run** + events → Firestore listener pushes it to every open dashboard → `buildRoster()` recomputes statuses.
**Run detection:** enters a stop → the previous run ends (if it was heading here) and a new run opens in *boarding*; leaves the stop → the run *starts*; a hop inside one zone (A loop → rain stop) goes back to boarding. If a phone is switched on mid-loop, the carrier taps where the shuttle is ("At the A loop", "On the road to the Annex"...).
**Geofence hysteresis:** arrive when inside R for a few seconds; depart only when beyond 1.5 R; re-entering before the debounce cancels an exit.
**Excused rule (per rider):** ride = scan → arrival at the other end. Excused if ride > normal + threshold (defaults 5 + 3 min, admin-configurable) **or** the shuttle arrives after the class bell. Computed on a *projected* arrival too, so it shows before the shuttle gets there.
**Free-tier write math:** see `DECISIONS.md` (≈1,200–2,400 writes/day for 2 shuttles vs a 20,000 cap; reads are the tighter limit).
**Edge cases:** GPS denied/blocked, no signal, wake-lock unsupported, shuttle phone offline (scans become unverified "shuttle phone offline"), two devices running the simulator (owner + tab lock).

## 4. Evidence, Results, Test Mode, AI note, pitch — *Teammate 4*
**Files:** `src/evidence/*`, `src/lib/metrics.ts`, `src/pages/evidence/*`, `src/ai/note.ts`, `src/pages/pitch/Pitch.tsx`, `src/components/charts/*`
**Testing method:** survey + interviews + ride-along → baseline; first-time-user tests in Test Mode (timed tasks, success/stuck, exit survey, optional SUS) round 1; real pilot; fixes logged in the Changelog; round 2 with new users.
**Every number** on Results is computed by `computeResults()` from the Evidence store and shows its **n** and source. Demo data is excluded unless you flip a visible switch. Missing data prints `[REPLACE WITH SURVEY DATA]`.
**AI note check:** the model writes the sentence; `validateNote()` extracts every integer and rejects it if any number was not supplied, or if a non-zero attention count is missing; then a template sentence is used instead. The teacher approves either one.
**Edge cases:** zero data, one-sided data (round 2 not run yet), demo vs real separation, AI off.

## Status vocabulary (one source of truth: `studentStatus.ts`)
| Status | When |
|---|---|
| ⚪ No shuttle needed | next class is in the same zone (A, D, E are connected inside) or the same building |
| ⏳ Hasn't boarded yet | no check-in, and the class bell has not rung |
| 🟢 On the way | verified check-in, ride within a normal time |
| 🟡 Excused: shuttle delay | verified check-in, and the ride is slow (or arrives after the bell) |
| 🟠 Unverified | scanned but the check could not confirm; teacher decides |
| 🔴 Not checked in | no check-in and the class bell has rung (neutral label, not "skipping"); teacher decides |
| ✅ Arrived | verified and the shuttle reached the other end in a normal time |
Each has an icon + words + color.
