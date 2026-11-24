import { EXERCISE_ICONS, type ExerciseIconDef } from "./exerciseIconData";
import type { Exercise, Load } from "../types";

export { EXERCISE_ICONS };
export type { ExerciseIconDef };

/** What an exercise shows when no icon has been picked: one per resistance
 * type, so the list isn't a column of identical blanks before anyone has
 * chosen anything. */
const DEFAULT_ICON_BY_KIND: Record<Load["kind"], string> = {
  freeWeight: "fitness_center",
  machine: "precision_manufacturing",
  band: "cable",
  loopBand: "all_inclusive",
  bodyweight: "accessibility_new",
};

export function defaultIconKey(kind: Load["kind"]): string {
  return DEFAULT_ICON_BY_KIND[kind];
}

/** The resistance type shown for an exercise in a given kind of workout. */
export function exerciseKind(exercise: Exercise, venue: "home" | "gym"): Load["kind"] {
  const target = exercise.targets[venue];
  return target.load?.kind ?? target.sides?.left.load.kind ?? "bodyweight";
}

/** The icon to draw: the one picked for this exercise, or — when none is
 * picked, or the stored key no longer exists — the default for its
 * resistance type. */
export function resolveExerciseIcon(exercise: Exercise, venue: "home" | "gym"): ExerciseIconDef {
  const chosen = exercise.icon ? EXERCISE_ICONS.find((i) => i.key === exercise.icon) : undefined;
  return chosen ?? iconByKey(defaultIconKey(exerciseKind(exercise, venue)));
}

export function iconByKey(key: string): ExerciseIconDef {
  return EXERCISE_ICONS.find((i) => i.key === key) ?? EXERCISE_ICONS[0];
}
