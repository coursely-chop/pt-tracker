import type { Note } from "../types";

/** Pinned notes first, then most-recent-first within each group. */
export function notesForExercise(notes: Note[], exerciseId: string): Note[] {
  return notes
    .filter((n) => n.exerciseId === exerciseId)
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
}
