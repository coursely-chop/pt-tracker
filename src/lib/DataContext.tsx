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
import { todayISO } from "./format";
import { slugify } from "./slug";
import type {
  Equipment,
  Exercise,
  ExerciseLinks,
  ExerciseTarget,
  Note,
  ProgressionEntry,
  Profile,
  SeedData,
  Superset,
  Workout,
  WorkoutCompletion,
  WorkoutProtocol,
} from "../types";

export interface ExerciseDetailsUpdate {
  name: string;
  progressionRule: string | null;
  cues: string[];
  tags: string[];
  links: ExerciseLinks;
}

export interface NewExerciseInput {
  name: string;
  target: ExerciseTarget;
  tags: string[];
  /** Omit to fall back to createExercise's own default (matching the working
   * reps) — pass explicitly once the New Exercise form lets the warmup be
   * configured directly, rather than always deriving it. */
  warmupReps?: number | null;
  warmupLoad?: Exercise["warmupLoad"];
}

export interface NewWorkoutInput {
  name: string;
  type: Workout["type"];
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
  updateExerciseTarget: (
    exerciseId: string,
    newTarget: ExerciseTarget,
    newEntries: ProgressionEntry[],
    warmupLoad: Exercise["warmupLoad"],
    warmupReps: Exercise["warmupReps"]
  ) => void;
  updateExerciseDetails: (exerciseId: string, updates: ExerciseDetailsUpdate) => void;
  createExercise: (input: NewExerciseInput) => string;
  createWorkout: (input: NewWorkoutInput) => string;
  updateWorkout: (workoutId: string, input: NewWorkoutInput) => void;
  deleteWorkout: (workoutId: string) => void;
  logWorkout: (workoutId: string) => void;
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
  editingDetailsExerciseId: string | null;
  openEditDetails: (exerciseId: string) => void;
  closeEditDetails: () => void;
  addOwnedDumbbell: (lbs: number) => void;
  removeOwnedDumbbell: (lbs: number) => void;
  addOwnedKettlebell: (lbs: number) => void;
  removeOwnedKettlebell: (lbs: number) => void;
  toggleOwnedBand: (color: string) => void;
  toggleOwnedLoopBand: (strength: string) => void;
  setLimitWeightToOwned: (limit: boolean) => void;
  setProfileName: (name: string) => void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<SeedData>(() => loadData());
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [editingExerciseIsGym, setEditingExerciseIsGym] = useState(false);
  const [editingDetailsExerciseId, setEditingDetailsExerciseId] = useState<string | null>(null);

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
  // current too. Silently does nothing if the sync backend isn't configured
  // (fetchCloudData resolves to nulls) or unreachable.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cloud = await fetchCloudData();
      if (cancelled) return;
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

  function updateExerciseTarget(
    exerciseId: string,
    newTarget: ExerciseTarget,
    newEntries: ProgressionEntry[],
    warmupLoad: Exercise["warmupLoad"],
    warmupReps: Exercise["warmupReps"]
  ) {
    const exercise = data.exercises.find((e) => e.id === exerciseId);
    if (!exercise) return;
    const updated: Exercise = {
      ...exercise,
      target: newTarget,
      progression: [...exercise.progression, ...newEntries],
      warmupLoad,
      warmupReps,
    };
    setData(saveExercise(updated));
  }

  // Deliberately separate from updateExerciseTarget: this never touches
  // target or progression[], so editing a cue can never generate a
  // progression entry the way an actual reps/weight change does.
  function updateExerciseDetails(exerciseId: string, updates: ExerciseDetailsUpdate) {
    const exercise = data.exercises.find((e) => e.id === exerciseId);
    if (!exercise) return;
    const updated: Exercise = { ...exercise, ...updates };
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
    // out of via Edit Details, not the default for something never reviewed.
    const defaultWarmupReps =
      target.perSide && target.sides
        ? Math.min(target.sides.left.reps, target.sides.right.reps)
        : target.reps ?? target.repRange.min;
    const exercise: Exercise = {
      id,
      name: input.name,
      target: input.target,
      warmupReps: input.warmupReps !== undefined ? input.warmupReps : defaultWarmupReps,
      warmupLoad: input.warmupLoad !== undefined ? input.warmupLoad : null,
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
      structure: { dynamicStretching: input.dynamicStretching, protocol: input.protocol },
      supersets: input.supersets,
    };
    setData(saveWorkout(workout));
  }

  function deleteWorkout(workoutId: string) {
    setData(deleteWorkoutFromStorage(workoutId));
  }

  function logWorkout(workoutId: string) {
    setData(saveCompletion({ workoutId, date: todayISO() }));
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

  function toggleOwnedBand(color: string) {
    const owned = data.equipment.ownedBands;
    const ownedBands = owned.includes(color) ? owned.filter((c) => c !== color) : [...owned, color];
    setData(saveEquipment({ ...data.equipment, ownedBands }));
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
    updateExerciseTarget,
    updateExerciseDetails,
    createExercise,
    createWorkout,
    updateWorkout,
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
    editingDetailsExerciseId,
    openEditDetails: setEditingDetailsExerciseId,
    closeEditDetails: () => setEditingDetailsExerciseId(null),
    addOwnedDumbbell,
    removeOwnedDumbbell,
    addOwnedKettlebell,
    removeOwnedKettlebell,
    toggleOwnedBand,
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
