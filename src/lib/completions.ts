import type { WorkoutCompletion } from "../types";

/** Most recent completion date for a workout, or undefined if never logged.
 * ISO date strings (YYYY-MM-DD) sort correctly as plain strings. */
export function lastCompletedDate(completions: WorkoutCompletion[], workoutId: string): string | undefined {
  const dates = completions.filter((c) => c.workoutId === workoutId).map((c) => c.date);
  if (dates.length === 0) return undefined;
  dates.sort();
  return dates[dates.length - 1];
}
