import { createContext, useContext, useState, type ReactNode } from "react";
import { deleteNote as deleteNoteFromStorage, loadData, saveCompletion, saveExercise, saveNote } from "./storage";
import { todayISO } from "./format";
import type {
  Exercise,
  ExerciseLinks,
  ExerciseTarget,
  Note,
  ProgressionEntry,
  SeedData,
  Workout,
  WorkoutCompletion,
} from "../types";

export interface ExerciseDetailsUpdate {
  warmup: string | null;
  progressionRule: string | null;
  cues: string[];
  links: ExerciseLinks;
}

interface DataContextValue {
  exercises: Exercise[];
  workouts: Workout[];
  completions: WorkoutCompletion[];
  notes: Note[];
  getExercise: (id: string) => Exercise | undefined;
  getWorkout: (id: string) => Workout | undefined;
  updateExerciseTarget: (exerciseId: string, newTarget: ExerciseTarget, newEntries: ProgressionEntry[]) => void;
  updateExerciseDetails: (exerciseId: string, updates: ExerciseDetailsUpdate) => void;
  logWorkout: (workoutId: string) => void;
  addNote: (exerciseId: string, text: string) => void;
  updateNoteText: (noteId: string, text: string) => void;
  toggleNotePinned: (noteId: string) => void;
  deleteNote: (noteId: string) => void;
  editingExerciseId: string | null;
  openEditMode: (exerciseId: string) => void;
  closeEditMode: () => void;
  editingDetailsExerciseId: string | null;
  openEditDetails: (exerciseId: string) => void;
  closeEditDetails: () => void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<SeedData>(() => loadData());
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [editingDetailsExerciseId, setEditingDetailsExerciseId] = useState<string | null>(null);

  const getExercise = (id: string) => data.exercises.find((e) => e.id === id);
  const getWorkout = (id: string) => data.workouts.find((w) => w.id === id);

  function updateExerciseTarget(exerciseId: string, newTarget: ExerciseTarget, newEntries: ProgressionEntry[]) {
    const exercise = data.exercises.find((e) => e.id === exerciseId);
    if (!exercise) return;
    const updated: Exercise = {
      ...exercise,
      target: newTarget,
      progression: [...exercise.progression, ...newEntries],
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

  const value: DataContextValue = {
    exercises: data.exercises,
    workouts: data.workouts,
    completions: data.completions,
    notes: data.notes,
    getExercise,
    getWorkout,
    updateExerciseTarget,
    updateExerciseDetails,
    logWorkout,
    addNote,
    updateNoteText,
    toggleNotePinned,
    deleteNote,
    editingExerciseId,
    openEditMode: setEditingExerciseId,
    closeEditMode: () => setEditingExerciseId(null),
    editingDetailsExerciseId,
    openEditDetails: setEditingDetailsExerciseId,
    closeEditDetails: () => setEditingDetailsExerciseId(null),
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within a DataProvider");
  return ctx;
}
