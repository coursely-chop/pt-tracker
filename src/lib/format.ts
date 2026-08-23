import { pickWarmupWeight } from "./equipment";
import { isRepRange, type Exercise, type ExerciseTarget, type Load, type RepsTarget } from "../types";

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** e.g. "5 lbs" or, for bands, "20 lbs (Blue band)" / "80 lbs (Red & Green Bands)". */
export function formatLoad(load: Load | null): string {
  if (!load) return "";
  switch (load.kind) {
    case "freeWeight":
      return `${load.lbs} lbs`;
    case "band": {
      const isPlural = load.bands.length > 1;
      const bandLabel = `${load.bands.map(capitalize).join(" & ")} ${isPlural ? "Bands" : "band"}`;
      return load.equivalentLbs ? `${load.equivalentLbs} lbs (${bandLabel})` : bandLabel;
    }
    case "bodyweight":
      return "Bodyweight";
  }
}

function formatReps(reps: number, repUnit?: string): string {
  const unit = repUnit ?? "rep";
  return `${reps} ${unit}${reps === 1 ? "" : "s"}`;
}

export function formatRepsTarget(reps: RepsTarget, repUnit?: string): string {
  if (isRepRange(reps)) {
    const unit = repUnit ?? "reps";
    return `${reps.min}-${reps.max} ${unit}`;
  }
  return formatReps(reps, repUnit);
}

/** e.g. "(x2) 15 reps @ 5 lbs" or, for asymmetric targets, "(x2) L: ...; R: ...". */
export function formatWorkingLine(sets: number, target: ExerciseTarget): string {
  if (target.sides) {
    const { left, right } = target.sides;
    const leftStr = `L: ${formatReps(left.reps, target.repUnit)} @ ${formatLoad(left.load)}`;
    const rightStr = `R: ${formatReps(right.reps, target.repUnit)} @ ${formatLoad(right.load)}`;
    return `(x${sets}) ${leftStr}; ${rightStr}`;
  }

  const repsStr =
    target.reps != null
      ? formatRepsTarget(target.reps, target.repUnit)
      : `${target.repRange.min}-${target.repRange.max} ${target.repUnit ?? "reps"}`;
  const loadStr = target.load ? formatLoad(target.load) : null;
  return loadStr ? `(x${sets}) ${repsStr} @ ${loadStr}` : `(x${sets}) ${repsStr}`;
}

/**
 * For exercises with a warmupSpec, computes an actual weight to grab from owned
 * equipment instead of leaving "50-75% of working weight" as mental math. Falls
 * back to the free-text warmup description for everything else (bands, bodyweight,
 * or free-weight exercises that haven't been given a warmupSpec).
 */
export function formatWarmupLine(sets: number, exercise: Exercise): string | null {
  const { warmup, warmupSpec, target } = exercise;

  if (warmupSpec && target.load?.kind === "freeWeight") {
    const snapped = pickWarmupWeight(target.load.lbs);
    const repsStr = formatReps(warmupSpec.reps, target.repUnit);
    const sideStr = target.perSide ? " each side" : "";
    return `(x${sets}) ${snapped} lbs for ${repsStr}${sideStr}`;
  }

  if (!warmup) return null;
  return `(x${sets}) ${warmup}`;
}
