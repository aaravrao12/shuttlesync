// Speed and ETA primitives. Plain arithmetic on purpose, explainable in 30 seconds:
//   ETA = remaining distance ÷ recent average speed (clamped to sane limits).
// What counts as "slow" or "excused" lives in lib/shuttle.ts (rideAssessment), not here.

export const MIN_SPEED_MPS = 1.2
export const MAX_SPEED_MPS = 12
export const DEFAULT_SPEED_MPS = 2.5

/** Rolling average of recent GPS speeds, clamped so a stopped shuttle doesn't give ETA = infinity. */
export function rollingAvgSpeed(prevAvg: number | undefined, sampleMps: number, weight = 0.2): number {
  const clampedSample = Math.min(MAX_SPEED_MPS, Math.max(0, sampleMps))
  const base = prevAvg ?? DEFAULT_SPEED_MPS
  // Ignore near-zero samples when at a stop: they say "dwelling", not "slow route".
  const next = clampedSample < 0.5 ? base : base * (1 - weight) + clampedSample * weight
  return Math.min(MAX_SPEED_MPS, Math.max(MIN_SPEED_MPS, next))
}

export function etaMinutes(distanceM: number, avgSpeedMps = DEFAULT_SPEED_MPS): number {
  const v = Math.min(MAX_SPEED_MPS, Math.max(MIN_SPEED_MPS, avgSpeedMps))
  return distanceM / v / 60
}
