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

export type Load = FreeWeightLoad | BandLoad | BodyweightLoad;

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
  /** Free-text fallback, shown as-is when warmupSpec isn't present (or doesn't apply). */
  warmup: string | null;
  /**
   * Present only for exercises where the warmup weight should be computed rather
   * than read as a vague percentage. Only takes effect when target.load is
   * freeWeight — see pickWarmupWeight in lib/equipment.ts.
   */
  warmupSpec?: { reps: number; percentRange: RepRange };
  progressionRule: string | null;
  cues: string[];
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

export interface SeedData {
  exercises: Exercise[];
  workouts: Workout[];
  completions: WorkoutCompletion[];
}
