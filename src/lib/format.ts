import { computeBandWeight, pickWarmupBand, pickWarmupWeight } from "./equipment";
import type { Equipment, Exercise, ExerciseTarget, Load } from "../types";

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatReps(reps: number, repUnit?: string): string {
  const unit = repUnit ?? "rep";
  return `${reps} ${unit}${reps === 1 ? "" : "s"}`;
}

/** One glanceable row: a weight/bodyweight label, the bands behind it (rendered
 * as color dots, not spelled out — see components/SetLines.tsx), and a rep count.
 * sideLabel is only set for an asymmetric exercise's Left/Right pair. */
export interface SetLineRow {
  sideLabel?: "L" | "R";
  text: string;
  bandColors: string[];
  reps: number;
}

/** sets is the set count for the section header (e.g. "Working (x2)") — kept
 * separate from the rows themselves, which are just weight/reps per side. */
export interface SetLines {
  sets: number;
  rows: SetLineRow[];
}

function loadToRow(load: Load | null): { text: string; bandColors: string[] } {
  if (!load || load.kind === "bodyweight") return { text: "Bodyweight", bandColors: [] };
  if (load.kind === "freeWeight") return { text: `${load.lbs} lbs`, bandColors: [] };
  const weight = computeBandWeight(load.bands);
  return { text: weight > 0 ? `${weight} lbs` : "—", bandColors: load.bands };
}

export function getWorkingLines(sets: number, target: ExerciseTarget): SetLines {
  if (target.sides) {
    const { left, right } = target.sides;
    return {
      sets,
      rows: [
        { sideLabel: "L", ...loadToRow(left.load), reps: left.reps },
        { sideLabel: "R", ...loadToRow(right.load), reps: right.reps },
      ],
    };
  }

  const reps = target.reps ?? target.repRange.min;
  return { sets, rows: [{ ...loadToRow(target.load), reps }] };
}

/** 50-75% of a working load, snapped to an actual weight/band from owned
 * equipment instead of left as mental math — see pickWarmupWeight/pickWarmupBand
 * in lib/equipment.ts. Bodyweight (and a null load) has nothing to scale, so it
 * computes to bodyweight too rather than needing a special case — and if you
 * own no free weights at all, pickWarmupWeight's 0 folds back into bodyweight
 * the same way, rather than displaying a nonsensical "0 lbs". */
export function computeWarmupLoad(load: Load | null, equipment: Equipment): Load {
  if (!load || load.kind === "bodyweight") return { kind: "bodyweight" };
  if (load.kind === "freeWeight") {
    // Dumbbells vs. kettlebells only matters for how Equipment Settings tracks
    // and labels them (pair vs. single) — for picking a warmup weight, either
    // is just a number you can grab, so the two lists are merged here.
    const owned = [...equipment.ownedDumbbells, ...equipment.ownedKettlebells];
    const lbs = pickWarmupWeight(load.lbs, owned);
    return lbs > 0 ? { kind: "freeWeight", lbs } : { kind: "bodyweight" };
  }
  return { kind: "band", bands: pickWarmupBand(load.bands, equipment.ownedBands) };
}

/**
 * Warmup is "linked" by default (warmupLoad is null) — always computed live as
 * 50-75% of the current working load. Setting warmupLoad "unlinks" it: an
 * independent load (or left/right pair, for an asymmetric exercise) takes over
 * instead, edited the same way as the working target in Edit Mode. warmupReps is
 * the one thing about warmup that never derives from the working target. Null
 * warmupReps means this exercise has no warmup at all — no line, computed or not.
 */
export function getWarmupLines(sets: number, exercise: Exercise, equipment: Equipment): SetLines | null {
  const { warmupReps, warmupLoad, target } = exercise;
  if (warmupReps == null) return null;

  if (target.sides) {
    const { left, right } = target.sides;
    const override = warmupLoad && "left" in warmupLoad ? warmupLoad : null;
    const leftLoad = override ? override.left : computeWarmupLoad(left.load, equipment);
    const rightLoad = override ? override.right : computeWarmupLoad(right.load, equipment);
    return {
      sets,
      rows: [
        { sideLabel: "L", ...loadToRow(leftLoad), reps: warmupReps },
        { sideLabel: "R", ...loadToRow(rightLoad), reps: warmupReps },
      ],
    };
  }

  const override = warmupLoad && !("left" in warmupLoad) ? warmupLoad : null;
  const load = override ?? computeWarmupLoad(target.load, equipment);
  return { sets, rows: [{ ...loadToRow(load), reps: warmupReps }] };
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
