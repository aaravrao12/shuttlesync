# Real-device checklist (do this BEFORE the pilot; this is what "core freeze" means)

Automated tests run on desktop Chromium. **Nothing in the repo can prove the app works on your students' phones**, so run this list on at least one iPhone (Safari) and one Android (Chrome), over school Wi-Fi *and* cellular. Tick, date, initial. Fix or log anything that fails before testing with students.

**Setup:** deploy to Vercel with real Firebase keys. Admin → Real pilot mode only when ready.

| # | Check | iPhone | Android |
|---|---|---|---|
| 1 | Open the link; page loads under 5 s on school Wi-Fi | | |
| 2 | "Add to Home Screen" installs; opens full screen | | |
| 3 | Consent → onboarding → schedule (type) completes | | |
| 4 | Schedule **photo** of a real printed schedule reads ≥ most classes (or fails gracefully) | | |
| 5 | Today shows the right bus and countdown | | |
| 6 | Scanner opens the camera, finds the QR in < 5 s in a bright room and on the bus | | |
| 7 | Deny camera → manual code entry works | | |
| 8 | Scan with location allowed, standing next to the bus phone → **verified** | | |
| 9 | Scan with location denied → **unverified** with a clear reason (not an error) | | |
| 10 | Scan indoors (poor GPS) → unverified/"inaccurate", not a crash | | |
| 11 | Bus phone: Start sharing; screen stays awake for a full trip (wake lock) | | |
| 12 | Bus phone: lock/unlock mid-trip; sharing resumes | | |
| 13 | Teacher dashboard (laptop) updates within ~2 s of a scan | | |
| 14 | Walk the bus phone into the C-building zone → "Bus 14 arrived at C" | | |
| 15 | Turn Wi-Fi off on the student phone mid-session → "You are offline" banner; reconnect → data syncs | | |
| 16 | Kiosk on a tablet at the stop checks a student in | | |
| 17 | Spanish toggle on a phone; text fits, nothing cut off | | |
| 18 | Battery: bus phone drains < ~15% per hour with screen on? Record: ____ | | |
| 19 | Print QR sheets; scan a printed code from 1 m | | |
| 20 | Reminder notification fires 2 min before leaving class (app open/installed) | | |

**Known platform differences to watch:** iOS Safari needs a user tap before camera/location prompts; iOS may not support Wake Lock on older versions (the bus page says so); notifications on iOS require an installed home-screen app.
