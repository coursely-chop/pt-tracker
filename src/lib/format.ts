import { computeBandWeight, pickWarmupWeight } from "./equipment";
import type { Exercise, ExerciseTarget, Load } from "../types";

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** e.g. "5 lbs" or, for bands, "10 lbs (Yellow band)" / "80 lbs (Red & Blue Bands)" —
 * the band weight is always computed from the bands themselves (see equipment.ts),
 * never stored, so it can't drift out of sync with the fixed per-color weights. */
export function formatLoad(load: Load | null): string {
  if (!load) return "";
  switch (load.kind) {
    case "freeWeight":
      return `${load.lbs} lbs`;
    case "band": {
      const isPlural = load.bands.length > 1;
      const bandLabel = `${load.bands.map(capitalize).join(" & ")} ${isPlural ? "Bands" : "band"}`;
      const weight = computeBandWeight(load.bands);
      return weight > 0 ? `${weight} lbs (${bandLabel})` : bandLabel;
    }
    case "bodyweight":
      return "Bodyweight";
  }
}

export function formatReps(reps: number, repUnit?: string): string {
  const unit = repUnit ?? "rep";
  return `${reps} ${unit}${reps === 1 ? "" : "s"}`;
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
      ? formatReps(target.reps, target.repUnit)
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

/** "2026-08-23" -> "Aug 23, 2026". Appending a time avoids the classic bare-date
 * timezone bug where `new Date("2026-08-23")` parses as UTC midnight and can
 * display as the previous day in negative-UTC-offset timezones. */
export function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
