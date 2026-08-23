import { computeBandWeight } from "./equipment";
import type { Exercise, Load } from "../types";

export interface HistoryPoint {
  date: string;
  weight: number;
  reps: number;
  side?: "left" | "right";
}

function extractWeight(load: Load | null): number | null {
  if (!load) return null;
  if (load.kind === "freeWeight") return load.lbs;
  if (load.kind === "band") {
    const weight = computeBandWeight(load.bands);
    return weight > 0 ? weight : null;
  }
  return null; // bodyweight has no weight dimension to plot
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
    const reps = entry.reps;
    if (weight == null || reps == null) continue;
    points.push({ date: entry.date, weight, reps, side: entry.side });
  }

  return { points, skippedCount: exercise.progression.length - points.length };
}
