import seedData from "../data/seed-data.json";
import { BAND_COLORS, DEFAULT_OWNED_DUMBBELLS, DEFAULT_OWNED_KETTLEBELLS, DEFAULT_OWNED_LOOP_BANDS } from "./equipment";
import type { Equipment, Exercise, Note, SeedData, Workout, WorkoutCompletion } from "../types";

/** Equipment shape before dumbbells/kettlebells were tracked separately — a
 * single undifferentiated free-weight list, implicitly assumed to be dumbbell
 * pairs (the only kind this app modeled at the time). Migrating treats that
 * whole list as dumbbells rather than splitting it by guessing. */
interface LegacyEquipment {
  ownedFreeWeights?: number[];
  ownedDumbbells?: number[];
  ownedKettlebells?: number[];
  ownedBands?: string[];
  ownedLoopBands?: string[];
  limitWeightToOwned?: boolean;
}

const STORAGE_KEY = "pt-tracker-data";

/** Shapes exercises could take on before warmup became structured — kept
 * narrowly here just for loadData's migration below. `warmup` was a free-text
 * override (and, further back, warmupSpec.reps held today's flat warmupReps);
 * neither converts to a real Load automatically, so migrating just drops them
 * in favor of the safe default (linked/computed) rather than guessing. */
interface LegacyExerciseFields {
  warmup?: string | null;
  warmupSpec?: { reps: number };
  warmupReps?: number | null;
  warmupLoad?: Exercise["warmupLoad"];
}

export function loadData(): SeedData {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    // Migration-safe: older localStorage snapshots predate the completions/notes fields,
    // older exercises predate the per-exercise tags field, and older exercises still
    // carry warmup as free text and/or warmupSpec.reps instead of warmupReps/warmupLoad.
    const parsed = JSON.parse(raw) as Partial<SeedData>;
    const seedExercises = (seedData as SeedData).exercises;
    return {
      exercises: (parsed.exercises ?? []).map((e) => {
        const legacy = e as Exercise & LegacyExerciseFields;
        const { warmup: _warmup, warmupSpec: _warmupSpec, ...rest } = legacy;
        // Backfills a still-null warmupReps from the current seed defaults for a
        // matching stock exercise id. A record's warmupLoad/warmupReps can't
        // otherwise distinguish "predates this field" from "deliberately turned
        // off" — saveExercise rewrites every exercise's shape on any single save,
        // not just the one being edited, so that signal is lost after one write.
        // Given this app has exactly one user and no one has had the *chance* to
        // deliberately disable warmup on a stock exercise yet, backfilling is the
        // safe read today; if that changes, this fallback would need a real
        // "explicitly configured" marker instead of inferring it from nullness.
        const seedDefault = seedExercises.find((se) => se.id === legacy.id);
        return {
          ...rest,
          tags: legacy.tags ?? [],
          warmupReps: legacy.warmupReps ?? legacy.warmupSpec?.reps ?? seedDefault?.warmupReps ?? null,
          warmupLoad: legacy.warmupLoad ?? null,
        };
      }),
      workouts: parsed.workouts ?? [],
      completions: parsed.completions ?? [],
      notes: parsed.notes ?? [],
      // Predates the Equipment screen (or predates the dumbbell/kettlebell split
      // within it) — defaults match what pickWarmupWeight/pickWarmupBand already
      // assumed before there was a setting for it, so this migration doesn't
      // change anyone's computed warmup results.
      equipment: ((): Equipment => {
        const legacy = parsed.equipment as LegacyEquipment | undefined;
        return {
          ownedDumbbells: legacy?.ownedDumbbells ?? legacy?.ownedFreeWeights ?? DEFAULT_OWNED_DUMBBELLS,
          ownedKettlebells: legacy?.ownedKettlebells ?? DEFAULT_OWNED_KETTLEBELLS,
          ownedBands: legacy?.ownedBands ?? [...BAND_COLORS],
          ownedLoopBands: legacy?.ownedLoopBands ?? DEFAULT_OWNED_LOOP_BANDS,
          limitWeightToOwned: legacy?.limitWeightToOwned ?? true,
        };
      })(),
    };
  }

  const initial = seedData as SeedData;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  return initial;
}

function saveData(data: SeedData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/** Replaces one exercise in storage (by id) and persists the whole data set. */
export function saveExercise(exercise: Exercise): SeedData {
  const data = loadData();
  const next: SeedData = {
    ...data,
    exercises: data.exercises.map((e) => (e.id === exercise.id ? exercise : e)),
  };
  saveData(next);
  return next;
}

/** Appends a brand-new exercise (from the Create New Home Workout flow's inline "+ New Exercise"). */
export function addExercise(exercise: Exercise): SeedData {
  const data = loadData();
  const next: SeedData = { ...data, exercises: [...data.exercises, exercise] };
  saveData(next);
  return next;
}

/** Appends a brand-new workout. */
export function addWorkout(workout: Workout): SeedData {
  const data = loadData();
  const next: SeedData = { ...data, workouts: [...data.workouts, workout] };
  saveData(next);
  return next;
}

/** Replaces one workout in storage (by id) and persists the whole data set. */
export function saveWorkout(workout: Workout): SeedData {
  const data = loadData();
  const next: SeedData = { ...data, workouts: data.workouts.map((w) => (w.id === workout.id ? workout : w)) };
  saveData(next);
  return next;
}

/** Permanently removes a workout, along with any completions logged against it —
 * a completion referencing a workout that no longer exists is meaningless, not
 * historical, so it isn't kept around as an orphan. */
export function deleteWorkout(workoutId: string): SeedData {
  const data = loadData();
  const next: SeedData = {
    ...data,
    workouts: data.workouts.filter((w) => w.id !== workoutId),
    completions: data.completions.filter((c) => c.workoutId !== workoutId),
  };
  saveData(next);
  return next;
}

/** Appends a workout completion record and persists the whole data set. */
export function saveCompletion(completion: WorkoutCompletion): SeedData {
  const data = loadData();
  const next: SeedData = { ...data, completions: [...data.completions, completion] };
  saveData(next);
  return next;
}

/** Adds a new note (unknown id) or replaces an existing one (e.g. toggling pinned, editing text). */
export function saveNote(note: Note): SeedData {
  const data = loadData();
  const exists = data.notes.some((n) => n.id === note.id);
  const notes = exists ? data.notes.map((n) => (n.id === note.id ? note : n)) : [...data.notes, note];
  const next: SeedData = { ...data, notes };
  saveData(next);
  return next;
}

/** Permanently removes a note. */
export function deleteNote(noteId: string): SeedData {
  const data = loadData();
  const next: SeedData = { ...data, notes: data.notes.filter((n) => n.id !== noteId) };
  saveData(next);
  return next;
}

/** Replaces the owned-equipment settings and persists the whole data set. */
export function saveEquipment(equipment: Equipment): SeedData {
  const data = loadData();
  const next: SeedData = { ...data, equipment };
  saveData(next);
  return next;
}

/** Current data as a pretty-printed JSON string, for a manual backup file —
 * this is the only durable protection against localStorage loss, since the
 * app has no backend. Goes through loadData() first so a backup taken before
 * a migration lands still exports today's shape, not whatever was on disk. */
export function exportDataAsJson(): string {
  return JSON.stringify(loadData(), null, 2);
}

/** Restores a previously exported backup, replacing everything currently in
 * storage. Only checks the top-level shape — a corrupt/unrelated file should
 * fail loudly here rather than silently produce a broken app afterward. */
export function restoreDataFromJson(json: string): void {
  const parsed = JSON.parse(json);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !Array.isArray(parsed.exercises) ||
    !Array.isArray(parsed.workouts) ||
    !Array.isArray(parsed.completions) ||
    !Array.isArray(parsed.notes) ||
    typeof parsed.equipment !== "object"
  ) {
    throw new Error("That doesn't look like a PT Tracker backup file.");
  }
  saveData(parsed as SeedData);
}
