import type { Exercise, Load } from "../types";

export interface HistoryPoint {
  date: string;
  weight: number;
  reps: number;
  side?: "left" | "right";
}

function extractWeight(load: Load | null): number | null {
  if (!load) return null;
  if (load.kind === "freeWeight" || load.kind === "machine" || load.kind === "band") return load.lbs;
  return null; // bodyweight has no weight dimension to plot
}

/**
 * Progression entries only get a weight+reps point on the chart when both are
 * present — some entries (older trainer notes, or a note-only entry with no
 * actual change) record just one or neither. skippedCount surfaces that so the
 * chart doesn't silently look sparser than the real history.
 */
export function getHistoryData(
  exercise: Exercise,
  venue: "home" | "gym"
): { points: HistoryPoint[]; skippedCount: number } {
  const points: HistoryPoint[] = [];
  // Home and Gym are independent timelines — an entry with no venue
  // predates the split and is Home.
  const entries = exercise.progression.filter((e) => (e.venue ?? "home") === venue);

  for (const entry of entries) {
    const weight = extractWeight(entry.load);
    const reps = entry.reps;
    if (weight == null || reps == null) continue;
    points.push({ date: entry.date, weight, reps, side: entry.side });
  }

  return { points, skippedCount: entries.length - points.length };
}
