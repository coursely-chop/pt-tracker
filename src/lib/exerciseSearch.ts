import type { Exercise } from "../types";

/** Case-insensitive substring match against the exercise's name or any of its
 * tags — "ar" matches both an "arm"-tagged and an "arms"-tagged exercise, by
 * design (tags are freeform, not a fixed taxonomy). */
export function searchExercises(exercises: Exercise[], query: string): Exercise[] {
  const q = query.trim().toLowerCase();
  if (!q) return exercises;
  return exercises.filter(
    (e) => e.name.toLowerCase().includes(q) || e.tags.some((tag) => tag.toLowerCase().includes(q))
  );
}
