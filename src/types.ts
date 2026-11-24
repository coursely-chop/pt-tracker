export interface FreeWeightLoad {
  kind: "freeWeight";
  lbs: number;
}

/** A tube band, by total resistance in lbs — no colors. Originally bands
 * were picked by color from a fixed five-color catalog and summed; that
 * stopped working once higher-resistance bands arrived in the same colors,
 * so resistance is now the only thing recorded. Stepped in 10 lb increments
 * in the editor, but any number is storable (older values like 65 are kept). */
export interface BandLoad {
  kind: "band";
  lbs: number;
}

export interface BodyweightLoad {
  kind: "bodyweight";
}

/** A weight-stack or plate-loaded machine — its own load kind because a
 * machine isn't owned equipment (no restrict-to-home-equipment logic
 * applies) and doesn't share free weights' fixed 0/3/5/+2.5 ladder: each
 * machine has its own increment (2.5, 5, 10, 15...), stored per-load since
 * it varies machine to machine, not app-wide. */
export interface MachineLoad {
  kind: "machine";
  lbs: number;
  increment: number;
}

/** A closed-loop resistance band (e.g. for lateral band walks) — a separate
 * catalog from the open tube BandLoad above (see Equipment.ownedLoopBands),
 * but combined the same way: multiple loop bands are often worn at once, so
 * this is an array of strengths, not a single value. */
export interface LoopBandLoad {
  kind: "loopBand";
  strengths: ("light" | "moderate" | "strong")[];
}

export type Load = FreeWeightLoad | BandLoad | BodyweightLoad | LoopBandLoad | MachineLoad;

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
  /** Which kind of workout the change was made from. Home and Gym weights
   * are independent (see ByWorkoutType), so a shared timeline mixed a gym
   * 45 lb press in with a home 20 lb one. Absent on entries from before
   * this field existed (the early trainer-note and pre-gym history), which
   * are all Home. */
  venue?: "home" | "gym";
}

export interface ExerciseLinks {
  instructional?: string;
  video?: string;
}

/** An independent ("unlinked") warmup load — a flat Load for a symmetric
 * exercise, or a left/right pair for an asymmetric one. Null means warmup is
 * "linked": always computed live as 50-75% of the current working load. */
export type WarmupOverride = Load | { left: Load; right: Load } | null;

/** A working target or warmup override, split by which kind of workout is
 * asking — Home and Gym get entirely independent values, never one shared
 * number. A weight dialed in at the gym (a full rack, specific machines) has
 * nothing to do with what's actually owned at home, so letting a gym edit
 * silently change what a home workout shows was a real bug, not just a UI
 * quirk — see git history for the report that prompted this split. Every
 * read site picks `home` or `gym` from whichever workout it's rendering for;
 * nothing falls back to "the other one" or merges them. */
export interface ByWorkoutType<T> {
  home: T;
  gym: T;
}

export interface Exercise {
  id: string;
  name: string;
  targets: ByWorkoutType<ExerciseTarget>;
  /** Rep count for warmup sets — the one thing about warmup that varies per
   * exercise and isn't derivable from the working target. Null means this
   * exercise has no warmup at all (and no computed line is shown). Shared
   * across Home and Gym — only the *weight*, not the rep count, is venue-
   * specific enough to need splitting. */
  warmupReps: number | null;
  /**
   * Null (the default) means warmup is "linked" — always computed live as
   * 50-75% of the current working load, via Edit Mode's checkbox. Set it to
   * "unlink" and warm up with an independent load instead, edited the same way
   * as the working target: a flat Load for a symmetric exercise, or a left/right
   * pair for the two asymmetric-by-injury exercises. Persists until re-linked.
   */
  warmupLoads: ByWorkoutType<WarmupOverride>;
  progressionRule: string | null;
  cues: string[];
  /** Freeform, e.g. "legs", "core" — powers the exercise picker's search in Create New Home Workout. */
  tags: string[];
  asymmetryNote?: string;
  progression: ProgressionEntry[];
  links: ExerciseLinks;
  alternateFor?: string;
  sourceNote?: string;
  /** Key into the curated icon set (lib/exerciseIconData.ts). Absent means
   * "automatic": a default picked from the exercise's resistance type. Shared
   * across Home and Gym, like the name. */
  icon?: string;
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
  /** "gym" workouts skip the home-equipment weight-stepper restriction
   * (Equipment.limitWeightToOwned) entirely, on the assumption a gym has a
   * full weight rack — everything else about a workout is identical either
   * way, including which exercises can be used. */
  type: "home" | "gym";
  structure: WorkoutStructure;
  supersets: Superset[];
}

/** "I did this workout today" — a timestamp, nothing more. Distinct from
 * per-exercise progression: this tracks that a workout happened, not what
 * happened inside it. */
export interface WorkoutCompletion {
  workoutId: string;
  date: string;
  /** Full ISO timestamp of the tap. `date` alone can't say what time it
   * happened (and is a UTC date, so it can land on tomorrow for an evening
   * workout) — the Home Screen's "completed today at 1:39 PM" card reads this
   * instead. Absent on completions logged before this field existed. */
  at?: string;
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
 * lib/equipment.ts (pickWarmupWeight/pickWarmupLoopBand). Doesn't restrict what
 * you can dial in for a *working* target: that stays free-form, since a
 * working weight can be anything and shouldn't be capped by what's already
 * on file. Dumbbells and kettlebells are tracked as separate lists (each just
 * owned lbs values, editable — add/remove) because they carry a different
 * real-world assumption: a dumbbell entry means an owned *pair*, a kettlebell
 * entry means one. For warmup-picking purposes the distinction doesn't
 * matter — either is just a weight you can grab — so pickWarmupWeight is
 * given the two lists merged; the split only matters for how Equipment
 * Settings displays and labels them. Tube bands aren't tracked as equipment
 * at all anymore (they're picked by resistance in lbs, not by owned color).
 * Loop bands are a small catalog (light/moderate/strong) tracked here since
 * they still have no lbs value to enter directly.
 */
export interface Equipment {
  ownedDumbbells: number[];
  ownedKettlebells: number[];
  ownedLoopBands: string[];
  /** When true (the default), the free-weight stepper in Edit Mode and New
   * Exercise only walks owned dumbbell/kettlebell values instead of the
   * fixed 0/3/5/+2.5 sequence — doesn't apply to Equipment's own "add a new
   * weight" stepper, where limiting to owned weights would be circular. */
  limitWeightToOwned: boolean;
}

/** Personal, non-equipment preferences — currently just the Home Screen
 * greeting name. Kept separate from Equipment since it's not physical gear. */
export interface Profile {
  name: string;
}

export interface SeedData {
  exercises: Exercise[];
  workouts: Workout[];
  completions: WorkoutCompletion[];
  notes: Note[];
  equipment: Equipment;
  profile: Profile;
}
