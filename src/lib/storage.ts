import seedData from "../data/seed-data.json";
import type { Exercise, SeedData, WorkoutCompletion } from "../types";

const STORAGE_KEY = "pt-tracker-data";

export function loadData(): SeedData {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    // Migration-safe: older localStorage snapshots predate the completions field.
    const parsed = JSON.parse(raw) as Partial<SeedData>;
    return {
      exercises: parsed.exercises ?? [],
      workouts: parsed.workouts ?? [],
      completions: parsed.completions ?? [],
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

/** Appends a workout completion record and persists the whole data set. */
export function saveCompletion(completion: WorkoutCompletion): SeedData {
  const data = loadData();
  const next: SeedData = { ...data, completions: [...data.completions, completion] };
  saveData(next);
  return next;
}
