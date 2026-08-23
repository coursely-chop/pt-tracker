import seedData from "../data/seed-data.json";
import type { Exercise, SeedData } from "../types";

const STORAGE_KEY = "pt-tracker-data";

export function loadData(): SeedData {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) return JSON.parse(raw) as SeedData;

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
