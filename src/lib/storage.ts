import seedData from "../data/seed-data.json";
import { BAND_COLORS, DEFAULT_OWNED_DUMBBELLS, DEFAULT_OWNED_KETTLEBELLS, DEFAULT_OWNED_LOOP_BANDS } from "./equipment";
import type { Equipment, Exercise, Note, Profile, SeedData, Workout, WorkoutCompletion } from "../types";

/** Workout shape before home/gym existed — every workout was implicitly a
 * home workout. */
interface LegacyWorkout {
  type?: Workout["type"];
}

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
const UPDATED_AT_KEY = "pt-tracker-updated-at";

// Set only when deployed with the sync backend configured (see api/data.ts) —
// undefined in local dev, where there's no server behind /api/data anyway.
const SYNC_SECRET = import.meta.env.VITE_SYNC_SECRET as string | undefined;

function touchUpdatedAt(): void {
  localStorage.setItem(UPDATED_AT_KEY, new Date().toISOString());
}

/** Timestamp of the last write this device knows to be current — either a
 * real local edit, or a confirmed-in-sync moment with the cloud copy. Used
 * to decide, on load, whether the cloud or local copy is more current. */
export function getLocalUpdatedAt(): string | null {
  return localStorage.getItem(UPDATED_AT_KEY);
}

/** Fire-and-forget push of the current data to the cloud copy — localStorage
 * has already been written by the time this is called, so a failure here
 * (offline, cold start, sync not configured yet) never blocks or loses the
 * local save; the next successful save (or the next load's reconciliation)
 * catches it up. */
async function pushToCloud(data: SeedData): Promise<void> {
  if (!SYNC_SECRET) return;
  try {
    const resp = await fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-sync-secret": SYNC_SECRET },
      body: JSON.stringify({ data }),
    });
    if (resp.ok) touchUpdatedAt();
  } catch {
    // offline or transient network failure — local save already succeeded.
  }
}

/** Cloud's current copy, for the once-per-load reconciliation in
 * DataContext. Returns nulls (rather than throwing) whenever the cloud
 * can't be reached at all, so a failure here just leaves the app running
 * on its local copy — never blocks startup. */
export async function fetchCloudData(): Promise<{ data: unknown; updatedAt: string | null }> {
  if (!SYNC_SECRET) return { data: null, updatedAt: null };
  try {
    const resp = await fetch("/api/data", { headers: { "x-sync-secret": SYNC_SECRET } });
    if (!resp.ok) return { data: null, updatedAt: null };
    return (await resp.json()) as { data: unknown; updatedAt: string | null };
  } catch {
    return { data: null, updatedAt: null };
  }
}

/** Pushes the given data to the cloud immediately — used by the load-time
 * reconciliation when local is the more current copy, distinct from the
 * fire-and-forget push every save already does. */
export function pushLocalToCloud(data: SeedData): void {
  void pushToCloud(data);
}

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

/** Migration-safe: older snapshots (local or cloud) predate the
 * completions/notes fields, older exercises predate the per-exercise tags
 * field, and older exercises still carry warmup as free text and/or
 * warmupSpec.reps instead of warmupReps/warmupLoad. Shared by loadData()
 * (localStorage) and the cloud-reconciliation path in DataContext, since a
 * cloud snapshot can be just as old-shaped as a local one. */
function migrate(parsed: Partial<SeedData>): SeedData {
  const seedExercises = (seedData as SeedData).exercises;
  return {
    exercises: (parsed.exercises ?? []).map((e) => {
      const legacy = e as Exercise & LegacyExerciseFields;
      const { warmup: _warmup, warmupSpec: _warmupSpec, ...rest } = legacy;
      // Backfills warmupReps from the current seed defaults only when the
      // field is truly absent (undefined) — a snapshot from before it
      // existed at all. `null` is a real, deliberate value now that Edit
      // Mode has a warmup enabled/disabled checkbox: it means "this
      // exercise's warmup is turned off," not "predates this field." Using
      // `??` here previously conflated the two, since it treats both
      // undefined and null as missing — that silently revived warmup on
      // every reload for any stock exercise where it had been turned off.
      const seedDefault = seedExercises.find((se) => se.id === legacy.id);
      const warmupReps =
        legacy.warmupReps !== undefined
          ? legacy.warmupReps
          : (legacy.warmupSpec?.reps ?? seedDefault?.warmupReps ?? null);
      return {
        ...rest,
        tags: legacy.tags ?? [],
        warmupReps,
        warmupLoad: legacy.warmupLoad ?? null,
      };
    }),
    workouts: (parsed.workouts ?? []).map((w) => ({ ...w, type: (w as Workout & LegacyWorkout).type ?? "home" })),
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
    // Predates the greeting name being editable — "Ben" matches what was
    // previously hardcoded in the Home Workouts header.
    profile: parsed.profile ?? { name: "Ben" },
  };
}

export function loadData(): SeedData {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    return migrate(JSON.parse(raw) as Partial<SeedData>);
  }

  const initial = seedData as SeedData;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  return initial;
}

/** Adopts a cloud snapshot as the new local truth — migrated the same way a
 * local snapshot would be, then written into localStorage so it survives
 * future loads without needing another round-trip to the cloud. */
export function adoptCloudData(rawCloudData: unknown): SeedData {
  const migrated = migrate(rawCloudData as Partial<SeedData>);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
  touchUpdatedAt();
  return migrated;
}

function saveData(data: SeedData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  touchUpdatedAt();
  void pushToCloud(data);
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

/** Replaces the profile (currently just the greeting name) and persists the whole data set. */
export function saveProfile(profile: Profile): SeedData {
  const data = loadData();
  const next: SeedData = { ...data, profile };
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
