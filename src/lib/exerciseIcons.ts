import { EXERCISE_ICONS, type ExerciseIconDef } from "./exerciseIconData";
import type { Exercise, Load } from "../types";

export type { ExerciseIconDef };

/** One icon per resistance type, so an exercise list isn't a column of
 * identical rows. Derived, never stored — change an exercise's resistance
 * type and its icon follows. */
const ICON_KEY_BY_KIND: Record<Load["kind"], string> = {
  freeWeight: "fitness_center",
  machine: "precision_manufacturing",
  band: "cable",
  loopBand: "all_inclusive",
  bodyweight: "accessibility_new",
};

export function iconForKind(kind: Load["kind"]): ExerciseIconDef {
  return EXERCISE_ICONS.find((i) => i.key === ICON_KEY_BY_KIND[kind]) ?? EXERCISE_ICONS[0];
}

/** The resistance type shown for an exercise in a given kind of workout. */
export function exerciseKind(exercise: Exercise, venue: "home" | "gym"): Load["kind"] {
  const target = exercise.targets[venue];
  return target.load?.kind ?? target.sides?.left.load.kind ?? "bodyweight";
}

export function resolveExerciseIcon(exercise: Exercise, venue: "home" | "gym"): ExerciseIconDef {
  return iconForKind(exerciseKind(exercise, venue));
}
