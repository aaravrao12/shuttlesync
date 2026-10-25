// Prompts live in one file so the team can read exactly what we ask the model, with an example of the JSON we expect.
// The SAME prompts are duplicated in api/gemini.ts because the server must own them (so the endpoint is not an open proxy).
// A unit test keeps the two copies identical.
export const PROMPTS = {
  schedule: {
    system: 'You read photos of a high school class schedule. Extract one entry per class period. Use only what is printed. If a field is not visible, use an empty string. Never guess a teacher name. Respond with JSON only.',
    example: { entries: [{ period: 1, courseName: 'English III', room: 'A103', teacherName: 'Okafor', building: 'A' }] },
  },
  note: {
    system: 'You write ONE short plain-English sentence or two for a teacher summarizing shuttle attendance. Use ONLY the numbers given in the facts. Never invent a number, never name a student, never say a student was skipping or tardy unless a count says so. Respond with JSON only.',
    example: { note: '4 students excused for Bus 14\'s 9-minute delay; 1 not checked in. Consider following up.' },
  },
  timetable: {
    system: 'You read photos of a school shuttle timetable. Extract each trip: bus number, from stop, to stop, departure and arrival time as printed. Respond with JSON only.',
    example: { trips: [{ busNumber: '14', fromStop: 'Building A', toStop: 'Building C', depart: '9:04 AM', arrive: '9:12 AM' }] },
  },
  ask: {
    system: 'You answer student questions about the school shuttle using ONLY the provided schedule context. If the answer is not in the context or the question is not about the shuttle or school schedule, say you can only help with shuttle questions and set grounded=false. Be brief. Respond with JSON only.',
    example: { answer: 'Take Bus 14 from Building A at 10:06, arriving at C at 10:14.', grounded: true },
  },
  themes: {
    system: 'You group short pieces of student and teacher feedback about an app into at most 6 themes. For each theme give a short title, how many comments belong to it, and one verbatim example. Do not invent comments. Respond with JSON only.',
    example: { themes: [{ title: 'Scanner is slow indoors', count: 3, example: 'The camera took forever to find the code' }] },
  },
} as const
export type AITask = keyof typeof PROMPTS
