import { describe, it, expect } from 'vitest'
import { mapTimetable } from '@/ai/timetable'
import { BUILDINGS, STOPS, makeBell, makeBuses } from '@/demo/seedData'

// NOT USED in the app (the shuttle has no timetable). The mapper is kept for schools that do, so it stays tested.
const ctx = { buses: makeBuses(), stops: STOPS, buildings: BUILDINGS, bell: makeBell(), date: '2026-02-03' }
const row = (o: object) => ({ busNumber: '1', fromStop: 'Building A', toStop: 'Building H', depart: '10:53 AM', arrive: '10:58 AM', ...o })

describe('timetable photo → trips (kept, switched off)', () => {
  it('maps a valid row to a trip in the right passing period', () => {
    const [r] = mapTimetable({ trips: [row({})] }, ctx)
    expect(r.problem).toBeUndefined(); expect(r.trip).toMatchObject({ busId: 'shuttle1', period: 3, fromStopId: 'stop-a', toStopId: 'stop-h', nextBell: 663 })
  })
  it('flags rows it cannot trust instead of guessing', () => {
    const rows = mapTimetable({ trips: [row({ busNumber: '99' }), row({ fromStop: 'The moon' }), row({ depart: '9:00 PM', arrive: '9:10 PM' }), row({ depart: '10:00 AM', arrive: '9:00 AM' })] }, ctx)
    expect(rows.map(r => r.problem)).toEqual(['Unknown bus "99"', 'Unknown stop "The moon"', 'Departure is not inside a passing period', 'Arrival is not after departure'])
  })
  it('accepts stop names given as just the letter', () => {
    expect(mapTimetable({ trips: [row({ fromStop: 'A', toStop: 'H' })] }, ctx)[0].trip).toBeTruthy()
  })
})
