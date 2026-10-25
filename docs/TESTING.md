# Testing and evidence protocol

The judges ask: *Did you ask anyone? Did anyone use it? What did you change?* This file is how the answer is yes, yes, and here is the list. Every claim on a slide traces to a row in the Evidence store (`/baseline`, `/test`, `/results`, `/changelog`) or a dated note.

## Roles
**Evidence lead** owns the survey, interview notes, pilot schedule and the Evidence store. Everyone helps recruit.

## Phase 0: prove the problem (before more code)
1. **Permission first.** Send the sponsor teacher a one-page plan (below). Get approval from sponsor + principal/AP + attendance office **in writing (email is fine)** before any real student data.
2. **Survey** (Google Form, anonymous, ~2 min, target 60+): rides per week; late-shuttle tardies last month; ever marked tardy/absent because of the shuttle; how they find their bus; confidence which bus goes where (1–5); would they scan a QR if it guaranteed no tardy; preferred language. Enter results on `/baseline` (metrics: `survey_responses`, `tardy_from_shuttle_pct`, `late_bus_per_month`, `would_scan_pct`, `prefers_spanish_pct`).
3. **Interviews** (10 min): 3+ students, 2+ teachers who receive riders, 1 attendance-office staff or AP. Record quotes **with permission** on `/baseline`.
4. **Ride-along** 2–3 days on the A⇄H loop: time each ride from the moment the shuttle leaves one loop to the moment it reaches the other, and enter each on `/baseline` → *Ride-along log*. This gives the real **normal ride time** to set in Admin → Shuttles and rules (default 5 minutes is a guess), and how much rides vary (which tells you what delay threshold is fair).
5. **Decide with the data** and note it in `DECISIONS.md` (e.g. if "nobody knows which bus" beats "late buses", lead with wayfinding).

## Phase 2: first-time-user tests (round 1, ~6–10 students + 2 teachers)
Use **Test Mode** (`/test`). Read the task, don't help, start the timer when they touch the screen.
- **Student tasks:** set up your schedule · find out whether you need the shuttle after period 3 and whether you will make it · check in on the shuttle.
- **Teacher tasks:** find who is on their way · find who has not boarded · approve the attendance note.
Then the 3-question exit survey and (optional) the 10-question **SUS**. Participants are P01, P02… never names.

## Phase 3: real pilot
The A⇄H loop, 1–2 transition periods, 15–30 students, 2–3 receiving teachers, 3–5 days. A student volunteer who already rides carries the shuttle phone (a *passenger*, not the driver). Kiosk covers students without phones. Switch Demo control → **Real pilot** first. **Fallback if real buses are blocked:** a realistic walk-through (students walk the real route at a real transition time while a teammate carries the bus phone along the shuttle path). **Say honestly in the pitch which kind of test it was.**

## Phase 4: iterate and re-test
Fix the top 3 problems, re-run the **same** task script with **new** users (round 2), log every change in `/changelog` (*users said → we changed → result after*).

## Consent wording (read aloud or paste into the form)
> "We're students building an app to help with late shuttles. It takes about 10 minutes. We'll write down what you do, not your name. You can stop any time. May we quote you without your name? Yes / No."

## One-page plan for the sponsor/AP
*What we collect:* the bus's location while it runs; a student's location **once, only when they scan**; the scan time and bus. *Who sees it:* that student, their teachers, and the school office. *How long:* check-ins are deleted after 30 days (a student can delete theirs any time). *AI:* only reads a photo of a schedule the student chooses to take; never decides attendance; no names sent. *What we need from you:* written approval for a pilot of [N] students on [route] for [dates].

## What to bring to judging
Survey stats, interview quotes (with permission), ride-along delays, pilot numbers (Results page, print view), the before/after table (round 1 vs 2), the Changelog, and 1–2 emailed teacher/admin quotes.

## Automated checks (what they do and don't prove)
`npm test` (94 unit tests incl. AI guardrails and i18n parity) · `npm run test:e2e` (student scans → teacher roster updates → bus arrives → "Arrived"; late bus excuses riders; axe WCAG A/AA in light+dark; no horizontal scroll 360–1920px). These run on desktop Chromium; **real-device behaviour is covered only by `docs/DEVICE-TEST.md`.**
**Manual accessibility checks to also do:** tab through every screen with the keyboard only; run VoiceOver/TalkBack on Today and Scan; 200% zoom; large-text setting.

## Results tables
Auto-generated on `/results` (and the pitch slide 6); print with *Print handout*. Do not copy numbers by hand.
