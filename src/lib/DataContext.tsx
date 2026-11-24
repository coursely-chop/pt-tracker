import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  addExercise,
  addWorkout,
  adoptCloudData,
  deleteNote as deleteNoteFromStorage,
  deleteWorkout as deleteWorkoutFromStorage,
  fetchCloudData,
  getLocalUpdatedAt,
  loadData,
  pushLocalToCloud,
  saveCompletion,
  saveEquipment,
  saveExercise,
  saveNote,
  saveProfile,
  saveWorkout,
} from "./storage";
import { localDateISO, todayISO } from "./format";
import { slugify } from "./slug";
import type {
  Equipment,
  Exercise,
  ExerciseTarget,
  Note,
  ProgressionEntry,
  Profile,
  SeedData,
  Superset,
  WarmupOverride,
  Workout,
  WorkoutCompletion,
  WorkoutProtocol,
} from "../types";

/** Everything the exercise sheet saves in one go: the (shared) name, plus the
 * working target and warmup for whichever venue it was opened from. `entries`
 * is the history to append — empty when nothing about the weights/reps
 * actually changed. */
export interface ExerciseUpdate {
  name: string;
  target: ExerciseTarget;
  entries: ProgressionEntry[];
  warmupLoad: WarmupOverride;
  warmupReps: Exercise["warmupReps"];
}

export interface NewExerciseInput {
  name: string;
  /** Seeds *both* the Home and Gym buckets with this same target — they only
   * diverge once one is actually edited independently. A brand-new exercise
   * is always created from within one specific workout, so there's only ever
   * one value to enter here; which bucket that workout happens to be isn't
   * this input's concern. */
  target: ExerciseTarget;
  tags: string[];
  /** Omit to fall back to createExercise's own default (matching the working
   * reps) — pass explicitly once the New Exercise form lets the warmup be
   * configured directly, rather than always deriving it. */
  warmupReps?: number | null;
  warmupLoad?: WarmupOverride;
}

export interface NewWorkoutInput {
  name: string;
  type: Workout["type"];
  emoji?: string;
  dynamicStretching: string;
  protocol: WorkoutProtocol;
  supersets: Superset[];
}

interface DataContextValue {
  exercises: Exercise[];
  workouts: Workout[];
  completions: WorkoutCompletion[];
  notes: Note[];
  equipment: Equipment;
  profile: Profile;
  getExercise: (id: string) => Exercise | undefined;
  getWorkout: (id: string) => Workout | undefined;
  updateExercise: (exerciseId: string, isGym: boolean, update: ExerciseUpdate) => void;
  createExercise: (input: NewExerciseInput) => string;
  createWorkout: (input: NewWorkoutInput) => string;
  updateWorkout: (workoutId: string, input: NewWorkoutInput) => void;
  /** Duplicates a workout — same type, protocol, dynamic stretching note, and
   * supersets/slots (same exercise ids; exercises themselves aren't touched,
   * just referenced again) — as a new, independent workout you can then edit
   * without affecting the original. Returns the new workout itself (id *and*
   * name — its name is generated here, not something a caller should
   * recompute) or undefined if workoutId doesn't resolve to a real workout. */
  cloneWorkout: (workoutId: string) => Workout | undefined;
  deleteWorkout: (workoutId: string) => void;
  /** Logs a completion for today, or — when `pastDate` (a local YYYY-MM-DD)
   * is given and isn't today — for that earlier day, for a workout done but
   * not recorded at the time. */
  logWorkout: (workoutId: string, pastDate?: string) => void;
  addNote: (exerciseId: string, text: string) => void;
  updateNoteText: (noteId: string, text: string) => void;
  toggleNotePinned: (noteId: string) => void;
  deleteNote: (noteId: string) => void;
  editingExerciseId: string | null;
  /** True when the exercise currently open in Edit Mode was reached from a
   * gym workout — LoadEditor reads this to skip the home-equipment stepper
   * restriction regardless of the global setting. */
  editingExerciseIsGym: boolean;
  openEditMode: (exerciseId: string, isGymWorkout?: boolean) => void;
  closeEditMode: () => void;
  addOwnedDumbbell: (lbs: number) => void;
  removeOwnedDumbbell: (lbs: number) => void;
  addOwnedKettlebell: (lbs: number) => void;
  removeOwnedKettlebell: (lbs: number) => void;
  toggleOwnedLoopBand: (strength: string) => void;
  setLimitWeightToOwned: (limit: boolean) => void;
  setProfileName: (name: string) => void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<SeedData>(() => loadData());
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [editingExerciseIsGym, setEditingExerciseIsGym] = useState(false);

  function openEditMode(exerciseId: string, isGymWorkout = false) {
    setEditingExerciseIsGym(isGymWorkout);
    setEditingExerciseId(exerciseId);
  }

  // Once per app load: reconcile the local copy against the cloud one.
  // localStorage is what the app already rendered from (instant, works
  // offline) — this only ever overrides it if the cloud copy is confirmed
  // more current, which is exactly the case that matters: local storage
  // having been wiped out from under the app (the actual failure this sync
  // exists to catch), where local has no data or no updatedAt to compare
  // against at all. Otherwise, local is pushed up so the cloud stays
  // current too — but only once the cloud has actually been reached.
  // `reachable: false` (sync not configured, offline, a bad response) must
  // never fall into "push local up": a wiped-and-reseeded local copy
  // combined with an unreachable cloud looks identical to a genuinely
  // up-to-date local copy, and pushing in that case would overwrite the
  // last good cloud copy with the empty reseeded one — the opposite of
  // what this sync exists to prevent. Unreachable just means try again
  // next load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cloud = await fetchCloudData();
      if (cancelled || !cloud.reachable) return;
      const localUpdatedAt = getLocalUpdatedAt();
      if (cloud.data !== null && cloud.updatedAt && (!localUpdatedAt || cloud.updatedAt > localUpdatedAt)) {
        setData(adoptCloudData(cloud.data));
      } else {
        setData((current) => {
          pushLocalToCloud(current);
          return current;
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const getExercise = (id: string) => data.exercises.find((e) => e.id === id);
  const getWorkout = (id: string) => data.workouts.find((w) => w.id === id);

  function updateExercise(exerciseId: string, isGym: boolean, update: ExerciseUpdate) {
    const exercise = data.exercises.find((e) => e.id === exerciseId);
    if (!exercise) return;
    const bucket = isGym ? "gym" : "home";
    // Saving several times in one day (fixing a typo, nudging a weight) keeps
    // only the last value for that day/venue/side, not one row per save —
    // the earlier ones were never real checkpoints. Entries carrying a note
    // are deliberate and always kept.
    const superseded = (p: ProgressionEntry) =>
      p.note === null &&
      update.entries.some((n) => n.date === p.date && n.side === p.side && (n.venue ?? "home") === (p.venue ?? "home"));
    const updated: Exercise = {
      ...exercise,
      name: update.name,
      targets: { ...exercise.targets, [bucket]: update.target },
      progression: [...exercise.progression.filter((p) => !superseded(p)), ...update.entries],
      warmupLoads: { ...exercise.warmupLoads, [bucket]: update.warmupLoad },
      warmupReps: update.warmupReps,
    };
    setData(saveExercise(updated));
  }

  function createExercise(input: NewExerciseInput): string {
    const id = slugify(
      input.name,
      data.exercises.map((e) => e.id)
    );
    const { target } = input;
    // New exercises start with a warmup on by default (matching the same rep
    // count as working) rather than none — "no warmup" is something you opt
    // out of in the exercise sheet, not the default for something never reviewed.
    const defaultWarmupReps =
      target.perSide && target.sides
        ? Math.min(target.sides.left.reps, target.sides.right.reps)
        : target.reps ?? target.repRange.min;
    const warmupLoad = input.warmupLoad !== undefined ? input.warmupLoad : null;
    const exercise: Exercise = {
      id,
      name: input.name,
      targets: { home: input.target, gym: input.target },
      warmupReps: input.warmupReps !== undefined ? input.warmupReps : defaultWarmupReps,
      warmupLoads: { home: warmupLoad, gym: warmupLoad },
      progressionRule: null,
      cues: [],
      tags: input.tags,
      links: {},
      progression: [],
    };
    setData(addExercise(exercise));
    return id;
  }

  function createWorkout(input: NewWorkoutInput): string {
    const id = slugify(
      input.name,
      data.workouts.map((w) => w.id)
    );
    const workout: Workout = {
      id,
      name: input.name,
      type: input.type,
      ...(input.emoji ? { emoji: input.emoji } : {}),
      structure: { dynamicStretching: input.dynamicStretching, protocol: input.protocol },
      supersets: input.supersets,
    };
    setData(addWorkout(workout));
    return id;
  }

  function updateWorkout(workoutId: string, input: NewWorkoutInput) {
    const workout: Workout = {
      id: workoutId,
      name: input.name,
      type: input.type,
      ...(input.emoji ? { emoji: input.emoji } : {}),
      structure: { dynamicStretching: input.dynamicStretching, protocol: input.protocol },
      supersets: input.supersets,
    };
    setData(saveWorkout(workout));
  }

  function cloneWorkout(workoutId: string): Workout | undefined {
    const original = data.workouts.find((w) => w.id === workoutId);
    if (!original) return undefined;
    const name = `${original.name} (Copy)`;
    const id = slugify(
      name,
      data.workouts.map((w) => w.id)
    );
    // Deep-copy via a JSON round-trip (same approach as LoadControls'
    // cloneLoad) so editing the clone's supersets/slots later can't mutate
    // the original through a shared nested array/object reference.
    const clone: Workout = { ...JSON.parse(JSON.stringify(original)), id, name };
    setData(addWorkout(clone));
    return clone;
  }

  function deleteWorkout(workoutId: string) {
    setData(deleteWorkoutFromStorage(workoutId));
  }

  function logWorkout(workoutId: string, pastDate?: string) {
    if (pastDate && pastDate !== localDateISO()) {
      // Noon local on the chosen day: there's no real time to record, and a
      // mid-day stamp keeps it on that calendar day in any timezone, so it
      // never reads as "completed today" on the Home Screen.
      const at = new Date(`${pastDate}T12:00:00`).toISOString();
      setData(saveCompletion({ workoutId, date: pastDate, at }));
      return;
    }
    setData(saveCompletion({ workoutId, date: todayISO(), at: new Date().toISOString() }));
  }

  function addNote(exerciseId: string, text: string) {
    const note: Note = {
      id: crypto.randomUUID(),
      exerciseId,
      text,
      createdAt: new Date().toISOString(),
      pinned: false,
    };
    setData(saveNote(note));
  }

  function updateNoteText(noteId: string, text: string) {
    const note = data.notes.find((n) => n.id === noteId);
    if (!note) return;
    // Editing fixes what was written, it isn't a new observation — createdAt (and
    // therefore sort position) stays put.
    setData(saveNote({ ...note, text }));
  }

  function toggleNotePinned(noteId: string) {
    const note = data.notes.find((n) => n.id === noteId);
    if (!note) return;
    setData(saveNote({ ...note, pinned: !note.pinned }));
  }

  function deleteNote(noteId: string) {
    setData(deleteNoteFromStorage(noteId));
  }

  function addOwnedDumbbell(lbs: number) {
    if (data.equipment.ownedDumbbells.includes(lbs)) return;
    const ownedDumbbells = [...data.equipment.ownedDumbbells, lbs].sort((a, b) => a - b);
    setData(saveEquipment({ ...data.equipment, ownedDumbbells }));
  }

  function removeOwnedDumbbell(lbs: number) {
    const ownedDumbbells = data.equipment.ownedDumbbells.filter((w) => w !== lbs);
    setData(saveEquipment({ ...data.equipment, ownedDumbbells }));
  }

  function addOwnedKettlebell(lbs: number) {
    if (data.equipment.ownedKettlebells.includes(lbs)) return;
    const ownedKettlebells = [...data.equipment.ownedKettlebells, lbs].sort((a, b) => a - b);
    setData(saveEquipment({ ...data.equipment, ownedKettlebells }));
  }

  function removeOwnedKettlebell(lbs: number) {
    const ownedKettlebells = data.equipment.ownedKettlebells.filter((w) => w !== lbs);
    setData(saveEquipment({ ...data.equipment, ownedKettlebells }));
  }

  function toggleOwnedLoopBand(strength: string) {
    const owned = data.equipment.ownedLoopBands;
    const ownedLoopBands = owned.includes(strength) ? owned.filter((s) => s !== strength) : [...owned, strength];
    setData(saveEquipment({ ...data.equipment, ownedLoopBands }));
  }

  function setLimitWeightToOwned(limitWeightToOwned: boolean) {
    setData(saveEquipment({ ...data.equipment, limitWeightToOwned }));
  }

  function setProfileName(name: string) {
    setData(saveProfile({ ...data.profile, name }));
  }

  const value: DataContextValue = {
    exercises: data.exercises,
    workouts: data.workouts,
    completions: data.completions,
    notes: data.notes,
    equipment: data.equipment,
    profile: data.profile,
    getExercise,
    getWorkout,
    updateExercise,
    createExercise,
    createWorkout,
    updateWorkout,
    cloneWorkout,
    deleteWorkout,
    logWorkout,
    addNote,
    updateNoteText,
    toggleNotePinned,
    deleteNote,
    editingExerciseId,
    editingExerciseIsGym,
    openEditMode,
    closeEditMode: () => setEditingExerciseId(null),
    addOwnedDumbbell,
    removeOwnedDumbbell,
    addOwnedKettlebell,
    removeOwnedKettlebell,
    toggleOwnedLoopBand,
    setLimitWeightToOwned,
    setProfileName,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within a DataProvider");
  return ctx;
}
