import type { WorkoutCompletion } from "../types";

/** Most recent completion date for a workout, or undefined if never logged.
 * ISO date strings (YYYY-MM-DD) sort correctly as plain strings. */
export function lastCompletedDate(completions: WorkoutCompletion[], workoutId: string): string | undefined {
  const dates = completions.filter((c) => c.workoutId === workoutId).map((c) => c.date);
  if (dates.length === 0) return undefined;
  dates.sort();
  return dates[dates.length - 1];
}

function sameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** When this workout was last logged, if that was today on the device's own
 * calendar — compared from the full timestamp in local time, not the stored
 * `date` (a UTC date that can already read as tomorrow by evening). Undefined
 * for completions without a timestamp, since there's no time to show. */
export function completedTodayAt(completions: WorkoutCompletion[], workoutId: string, now = new Date()): Date | undefined {
  const times = completions
    .filter((c) => c.workoutId === workoutId && c.at)
    .map((c) => new Date(c.at as string))
    .filter((d) => sameLocalDay(d, now))
    .sort((a, b) => a.getTime() - b.getTime());
  return times[times.length - 1];
}

export function formatTimeOfDay(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
