import { createContext, useContext, useState, type ReactNode } from "react";
import { loadData, saveExercise } from "./storage";
import type { Exercise, ExerciseTarget, ProgressionEntry, SeedData, Workout } from "../types";

interface DataContextValue {
  exercises: Exercise[];
  workouts: Workout[];
  getExercise: (id: string) => Exercise | undefined;
  getWorkout: (id: string) => Workout | undefined;
  updateExerciseTarget: (exerciseId: string, newTarget: ExerciseTarget, newEntries: ProgressionEntry[]) => void;
  editingExerciseId: string | null;
  openEditMode: (exerciseId: string) => void;
  closeEditMode: () => void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<SeedData>(() => loadData());
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);

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

  const value: DataContextValue = {
    exercises: data.exercises,
    workouts: data.workouts,
    getExercise,
    getWorkout,
    updateExerciseTarget,
    editingExerciseId,
    openEditMode: setEditingExerciseId,
    closeEditMode: () => setEditingExerciseId(null),
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within a DataProvider");
  return ctx;
}
