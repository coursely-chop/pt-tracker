import type { Workout } from "../types";

const KEY = "pt-tracker-home-tab";

/** Path to the Home Screen opened on a given tab. Every back link out of a
 * workout uses this so a Gym workout returns to Gym Workouts, not Home. */
export function homePath(type: Workout["type"]): string {
  return `/?tab=${type}`;
}

function parseTab(value: string | null): Workout["type"] | null {
  return value === "home" || value === "gym" ? value : null;
}

/** The tab the Home Screen should open on: an explicit `?tab=` wins, else the
 * last one used on this device, else Home. */
export function initialHomeTab(param: string | null): Workout["type"] {
  const fromParam = parseTab(param);
  if (fromParam) {
    rememberHomeTab(fromParam);
    return fromParam;
  }
  try {
    return parseTab(localStorage.getItem(KEY)) ?? "home";
  } catch {
    return "home";
  }
}

export function rememberHomeTab(tab: Workout["type"]): void {
  try {
    localStorage.setItem(KEY, tab);
  } catch {
    // private mode / blocked storage — the tab just won't be remembered.
  }
}
