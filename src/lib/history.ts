import { isRepRange, type Exercise, type Load, type RepsTarget } from "../types";

export interface HistoryPoint {
  date: string;
  weight: number;
  reps: number;
  side?: "left" | "right";
}

function extractWeight(load: Load | null): number | null {
  if (!load) return null;
  if (load.kind === "freeWeight") return load.lbs;
  if (load.kind === "band") return load.equivalentLbs ?? null;
  return null; // bodyweight has no weight dimension to plot
}

function extractReps(reps: RepsTarget | null): number | null {
  if (reps == null) return null;
  // A range (e.g. 12-15) isn't a single point — the midpoint stands in for it.
  return isRepRange(reps) ? (reps.min + reps.max) / 2 : reps;
}

/**
 * Progression entries only get a weight+reps point on the chart when both are
 * present — some entries (older trainer notes, or a note-only entry with no
 * actual change) record just one or neither. skippedCount surfaces that so the
 * chart doesn't silently look sparser than the real history.
 */
export function getHistoryData(exercise: Exercise): { points: HistoryPoint[]; skippedCount: number } {
  const points: HistoryPoint[] = [];

  for (const entry of exercise.progression) {
    const weight = extractWeight(entry.load);
    const reps = extractReps(entry.reps);
    if (weight == null || reps == null) continue;
    points.push({ date: entry.date, weight, reps, side: entry.side });
  }

  return { points, skippedCount: exercise.progression.length - points.length };
}
