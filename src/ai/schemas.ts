// Zod schemas for every AI response. Nothing the model says reaches the UI without passing through one of these.
import { z } from 'zod'

export const ScheduleExtraction = z.object({
  entries: z.array(z.object({
    period: z.number().int().min(1).max(12),
    courseName: z.string().min(1).max(80),
    room: z.string().max(20).default(''),
    teacherName: z.string().max(60).default(''),
    building: z.string().max(10).default(''),
  })).max(12),
})
export type ScheduleExtraction = z.infer<typeof ScheduleExtraction>

export const NoteResult = z.object({ note: z.string().min(10).max(500) })

export const TimetableExtraction = z.object({
  trips: z.array(z.object({
    busNumber: z.string().max(10),
    fromStop: z.string().max(40),
    toStop: z.string().max(40),
    depart: z.string().regex(/^\d{1,2}:\d{2}\s*(am|pm)?$/i),
    arrive: z.string().regex(/^\d{1,2}:\d{2}\s*(am|pm)?$/i),
  })).max(80),
})
export type TimetableExtraction = z.infer<typeof TimetableExtraction>

export const AskResult = z.object({ answer: z.string().min(1).max(600), grounded: z.boolean() })

export const ThemeResult = z.object({
  themes: z.array(z.object({ title: z.string().max(60), count: z.number().int().min(1), example: z.string().max(200) })).max(8),
})
export type ThemeResult = z.infer<typeof ThemeResult>
