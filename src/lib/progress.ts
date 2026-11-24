import { getHistoryData, type HistoryPoint } from "./history";
import type { Exercise } from "../types";

export interface SeriesSummary {
  /** Undefined for a combined (not left/right) series. */
  side?: "left" | "right";
  /** Oldest first. */
  points: HistoryPoint[];
  first: HistoryPoint;
  last: HistoryPoint;
  /** Latest weight minus the first recorded weight, in lbs. */
  delta: number;
}

export interface ExerciseProgress {
  exercise: Exercise;
  /** One per side that has data — a single combined series for most exercises,
   * left and right for one split by side. */
  series: SeriesSummary[];
  /** Most recent date any series changed — what the list is ordered by. */
  lastDate: string;
  /** Earliest date across series — the "since" in the summary line. */
  firstDate: string;
}

/** Every exercise with at least one plottable point for this kind of
 * workout, most recently changed first. Home and Gym are independent, so an
 * exercise only shows up under a venue it actually has history in. */
export function getProgress(exercises: Exercise[], venue: "home" | "gym"): ExerciseProgress[] {
  const rows: ExerciseProgress[] = [];

  for (const exercise of exercises) {
    const { points } = getHistoryData(exercise, venue);
    if (points.length === 0) continue;

    const bySide = new Map<string, HistoryPoint[]>();
    for (const p of points) {
      const key = p.side ?? "combined";
      bySide.set(key, [...(bySide.get(key) ?? []), p]);
    }

    const series: SeriesSummary[] = [...bySide.entries()]
      .map(([key, pts]) => {
        // Stable sort: same-day points keep the order they were recorded in,
        // so "last" is genuinely the latest.
        const sorted = [...pts].sort((a, b) => a.date.localeCompare(b.date));
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        return {
          side: key === "combined" ? undefined : (key as "left" | "right"),
          points: sorted,
          first,
          last,
          delta: last.weight - first.weight,
        };
      })
      // Left before right, combined first.
      .sort((a, b) => (a.side ?? "").localeCompare(b.side ?? ""));

    const dates = series.flatMap((s) => [s.first.date, s.last.date]).sort();
    rows.push({ exercise, series, firstDate: dates[0], lastDate: dates[dates.length - 1] });
  }

  return rows.sort((a, b) => b.lastDate.localeCompare(a.lastDate) || a.exercise.name.localeCompare(b.exercise.name));
}

/** "+25 lbs", "-10 lbs", or "no change" — the sign is always explicit so an
 * increase and a decrease can't be confused at a glance. */
export function formatDelta(delta: number): string {
  if (delta === 0) return "no change";
  const rounded = Math.round(delta * 10) / 10;
  return `${rounded > 0 ? "+" : "−"}${Math.abs(rounded)} lbs`;
}
