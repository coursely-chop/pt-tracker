export interface FreeWeightLoad {
  kind: "freeWeight";
  lbs: number;
}

export interface BandLoad {
  kind: "band";
  bands: string[];
}

export interface BodyweightLoad {
  kind: "bodyweight";
}

/** A closed-loop resistance band (e.g. for lateral band walks) — a separate
 * catalog from the open tube BandLoad above (see Equipment.ownedLoopBands),
 * but combined the same way: multiple loop bands are often worn at once, so
 * this is an array of strengths, not a single value. */
export interface LoopBandLoad {
  kind: "loopBand";
  strengths: ("light" | "moderate" | "strong")[];
}

export type Load = FreeWeightLoad | BandLoad | BodyweightLoad | LoopBandLoad;

export interface RepRange {
  min: number;
  max: number;
}

export interface SideTarget {
  load: Load;
  reps: number;
  tempo?: string;
}

export interface ExerciseTarget {
  /** The exercise's general prescribed range (e.g. 8-15) — metadata, not what Edit Mode changes. */
  repRange: RepRange;
  repUnit?: string;
  perSide: boolean;
  /** The live working-set target — what Edit Mode actually changes. */
  reps: number | null;
  load: Load | null;
  sides: { left: SideTarget; right: SideTarget } | null;
}

export interface ProgressionEntry {
  date: string;
  load: Load | null;
  reps: number | null;
  note: string | null;
  side?: "left" | "right";
}

export interface ExerciseLinks {
  instructional?: string;
  video?: string;
}

export interface Exercise {
  id: string;
  name: string;
  target: ExerciseTarget;
  /** Rep count for warmup sets — the one thing about warmup that varies per
   * exercise and isn't derivable from the working target. Null means this
   * exercise has no warmup at all (and no computed line is shown). */
  warmupReps: number | null;
  /**
   * Null (the default) means warmup is "linked" — always computed live as
   * 50-75% of the current working load, via Edit Mode's checkbox. Set it to
   * "unlink" and warm up with an independent load instead, edited the same way
   * as the working target: a flat Load for a symmetric exercise, or a left/right
   * pair for the two asymmetric-by-injury exercises. Persists until re-linked.
   */
  warmupLoad: Load | { left: Load; right: Load } | null;
  progressionRule: string | null;
  cues: string[];
  /** Freeform, e.g. "legs", "core" — powers the exercise picker's search in Create New Home Workout. */
  tags: string[];
  asymmetryNote?: string;
  progression: ProgressionEntry[];
  links: ExerciseLinks;
  alternateFor?: string;
  sourceNote?: string;
}

export interface Range {
  min: number;
  max: number;
}

export interface WorkoutProtocol {
  workingSets: number;
  warmupSets: number;
  restBetweenExercisesSec: Range;
  restBetweenSupersetsSec: Range;
  notes: string;
}

export interface WorkoutStructure {
  dynamicStretching: string;
  protocol: WorkoutProtocol;
}

export interface SupersetSlot {
  order: number;
  exerciseIds: string[];
}

export interface Superset {
  order: number;
  slots: SupersetSlot[];
}

export interface Workout {
  id: string;
  name: string;
  structure: WorkoutStructure;
  supersets: Superset[];
}

/** "I did this workout today" — a timestamp, nothing more. Distinct from
 * per-exercise progression: this tracks that a workout happened, not what
 * happened inside it. */
export interface WorkoutCompletion {
  workoutId: string;
  date: string;
}

/**
 * A free-text observation on an exercise — guidance or how a session felt,
 * not structured data. createdAt is a full timestamp (not just a date, unlike
 * ProgressionEntry/WorkoutCompletion) since notes can realistically be added
 * more than once in a day and need to sort correctly against each other.
 */
export interface Note {
  id: string;
  exerciseId: string;
  text: string;
  createdAt: string;
  pinned: boolean;
}

/**
 * What's actually sitting in the closet — feeds the warmup computation in
 * lib/equipment.ts (pickWarmupWeight/pickWarmupBand). Doesn't restrict what
 * you can dial in for a *working* target: that stays free-form, since a
 * working weight can be anything and shouldn't be capped by what's already
 * on file. Dumbbells and kettlebells are tracked as separate lists (each just
 * owned lbs values, editable — add/remove) because they carry a different
 * real-world assumption: a dumbbell entry means an owned *pair*, a kettlebell
 * entry means one. For warmup-picking purposes the distinction doesn't
 * matter — either is just a weight you can grab — so pickWarmupWeight is
 * given the two lists merged; the split only matters for how Equipment
 * Settings displays and labels them. Bands are a subset of the fixed
 * BAND_WEIGHTS catalog in lib/equipment.ts (color-to-weight is physical, not
 * user-configurable — only *which* colors you own is). Loop bands are a
 * separate, smaller catalog (light/moderate/strong) tracked the same way —
 * kept apart from ownedBands since they're a physically different kind of
 * band (closed loop, one worn at a time) even though "blue" and "black"
 * happen to name a color in both catalogs.
 */
export interface Equipment {
  ownedDumbbells: number[];
  ownedKettlebells: number[];
  ownedBands: string[];
  ownedLoopBands: string[];
}

export interface SeedData {
  exercises: Exercise[];
  workouts: Workout[];
  completions: WorkoutCompletion[];
  notes: Note[];
  equipment: Equipment;
}
