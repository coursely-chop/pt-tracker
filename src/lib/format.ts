import {
  BAND_COLORS,
  BAND_HEX,
  LOOP_BAND_HEX,
  LOOP_BAND_STRENGTHS,
  computeBandWeight,
  pickWarmupBand,
  pickWarmupLoopBand,
  pickWarmupWeight,
} from "./equipment";
import type { Equipment, Exercise, ExerciseTarget, Load, LoopBandLoad } from "../types";

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
  /** Resolved hex colors for the small dots under this row, already looked up
   * from whichever catalog applies (tube band vs. loop band) — SetLines.tsx
   * just paints them, it doesn't need to know which kind of band they came
   * from. */
  swatches: string[];
  reps: number;
}

/** sets is the set count for the section header (e.g. "Working (x2)") — kept
 * separate from the rows themselves, which are just weight/reps per side. */
export interface SetLines {
  sets: number;
  rows: SetLineRow[];
}

function loadToRow(load: Load | null): { text: string; swatches: string[] } {
  if (!load || load.kind === "bodyweight") return { text: "Bodyweight", swatches: [] };
  if (load.kind === "freeWeight" || load.kind === "machine") return { text: `${load.lbs} lbs`, swatches: [] };
  if (load.kind === "loopBand") {
    const label = load.strengths.map(capitalize).join(" + ");
    return { text: label || "—", swatches: load.strengths.map((s) => LOOP_BAND_HEX[s]) };
  }
  // A direct resistance override has no colors behind it — nothing to render as dots.
  if (load.overrideLbs != null) return { text: `${load.overrideLbs} lbs`, swatches: [] };
  const weight = computeBandWeight(load.bands);
  return { text: weight > 0 ? `${weight} lbs` : "—", swatches: load.bands.map((color) => BAND_HEX[color]) };
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

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** 50-75% of a working load (the midpoint, 62.5%, once it needs to collapse to
 * one number to round). Bodyweight (and a null load) has nothing to scale, so
 * it computes to bodyweight too rather than needing a special case.
 *
 * `isGym` matters because a machine or gym free weight isn't owned equipment
 * at all — snapping a gym warmup to *home* dumbbells/bands (what this used to
 * do unconditionally) picked whatever you happen to own at home, regardless
 * of what the gym actually has. In gym mode, free weight and band/loop-band
 * warmups round to a plain number or search the full color catalog instead of
 * owned equipment — the same "no home-equipment restriction" gym already gets
 * on the working-set stepper (see GymModeContext in EditModeSheet.tsx). */
export function computeWarmupLoad(load: Load | null, equipment: Equipment, isGym: boolean): Load {
  if (!load || load.kind === "bodyweight") return { kind: "bodyweight" };
  if (load.kind === "machine") {
    // Not owned equipment at all — always rounds to the machine's own
    // increment, gym or home, same as pickWarmupWeight's in-range/closest
    // logic would if that increment were a fixed owned-weight list of one.
    const lbs = Math.max(0, roundTo(load.lbs * 0.625, load.increment));
    return lbs > 0 ? { kind: "machine", lbs, increment: load.increment } : { kind: "bodyweight" };
  }
  if (load.kind === "freeWeight") {
    if (isGym) {
      const lbs = Math.max(0, roundTo(load.lbs * 0.625, 2.5));
      return lbs > 0 ? { kind: "freeWeight", lbs } : { kind: "bodyweight" };
    }
    // Dumbbells vs. kettlebells only matters for how Equipment Settings tracks
    // and labels them (pair vs. single) — for picking a warmup weight, either
    // is just a number you can grab, so the two lists are merged here.
    const owned = [...equipment.ownedDumbbells, ...equipment.ownedKettlebells];
    const lbs = pickWarmupWeight(load.lbs, owned);
    return lbs > 0 ? { kind: "freeWeight", lbs } : { kind: "bodyweight" };
  }
  if (load.kind === "loopBand") {
    const catalog = isGym ? LOOP_BAND_STRENGTHS : equipment.ownedLoopBands;
    const strengths = pickWarmupLoopBand(load.strengths, catalog);
    return strengths.length > 0 ? { kind: "loopBand", strengths: strengths as LoopBandLoad["strengths"] } : { kind: "bodyweight" };
  }
  // A direct resistance override (see BandLoad.overrideLbs) has no colors to
  // search against — round the number itself instead of picking a combo.
  if (load.overrideLbs != null) {
    const lbs = Math.max(0, roundTo(load.overrideLbs * 0.625, 5));
    return lbs > 0 ? { kind: "band", bands: [], overrideLbs: lbs } : { kind: "bodyweight" };
  }
  const catalog = isGym ? BAND_COLORS : equipment.ownedBands;
  return { kind: "band", bands: pickWarmupBand(load.bands, catalog) };
}

/**
 * Warmup is "linked" by default (warmupLoad is null) — always computed live as
 * 50-75% of the current working load. Setting warmupLoad "unlinks" it: an
 * independent load (or left/right pair, for an asymmetric exercise) takes over
 * instead, edited the same way as the working target in Edit Mode. warmupReps is
 * the one thing about warmup that never derives from the working target. Null
 * warmupReps means this exercise has no warmup at all — no line, computed or not.
 */
export function getWarmupLines(sets: number, exercise: Exercise, equipment: Equipment, isGym: boolean): SetLines | null {
  const { warmupReps, warmupLoad, target } = exercise;
  if (warmupReps == null) return null;

  if (target.sides) {
    const { left, right } = target.sides;
    const override = warmupLoad && "left" in warmupLoad ? warmupLoad : null;
    const leftLoad = override ? override.left : computeWarmupLoad(left.load, equipment, isGym);
    const rightLoad = override ? override.right : computeWarmupLoad(right.load, equipment, isGym);
    return {
      sets,
      rows: [
        { sideLabel: "L", ...loadToRow(leftLoad), reps: warmupReps },
        { sideLabel: "R", ...loadToRow(rightLoad), reps: warmupReps },
      ],
    };
  }

  const override = warmupLoad && !("left" in warmupLoad) ? warmupLoad : null;
  const load = override ?? computeWarmupLoad(target.load, equipment, isGym);
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
