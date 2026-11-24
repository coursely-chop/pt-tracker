import { useContext, useState } from "react";
import ExerciseSheet, { makeDraftExercise } from "./ExerciseSheet";
import { GymModeContext } from "./LoadControls";
import { searchExercises } from "../lib/exerciseSearch";
import { useBodyScrollLock } from "../lib/useBodyScrollLock";
import { useData } from "../lib/DataContext";

interface ExercisePickerSheetProps {
  onClose: () => void;
  onSelect: (exerciseId: string) => void;
  /** Exercise ids already in the superset this picker is adding to — rendered
   * disabled rather than hidden, so it's clear *why* they can't be tapped again
   * instead of the library appearing to have shrunk. */
  excludeExerciseIds: string[];
}

type Mode = "browse" | "create";

/** Reached when adding an exercise to a slot in Create New Home Workout: search the
 * existing library by name or tag, or — once a search matches nothing — create one
 * that doesn't exist yet, right in that empty-results spot, rather than a separate
 * "+ New Exercise" trigger. Creating opens the exercise sheet itself (the same one
 * used to edit an exercise). Full-screen, top-aligned takeover (not a bottom sheet)
 * since the search results can run long, and it locks background scroll for as long
 * as it's open, so it isn't a second scroll area fighting the page behind it. */
export default function ExercisePickerSheet({ onClose, onSelect, excludeExerciseIds }: ExercisePickerSheetProps) {
  const { exercises, createExercise } = useData();
  const isGym = useContext(GymModeContext);
  const [mode, setMode] = useState<Mode>("browse");
  const [query, setQuery] = useState("");

  useBodyScrollLock();

  const results = searchExercises(exercises, query);
  const trimmedQuery = query.trim();

  // Creating a new exercise is the same sheet used to edit one — name,
  // resistance, warmup, working — not a second, separately-maintained form.
  if (mode === "create") {
    return (
      <ExerciseSheet
        isNew
        isGym={isGym}
        exercise={makeDraftExercise(trimmedQuery)}
        onClose={() => setMode("browse")}
        onSave={(update) => {
          const id = createExercise({
            name: update.name,
            target: update.target,
            tags: [],
            warmupReps: update.warmupReps,
            warmupLoad: update.warmupLoad,
          });
          onSelect(id);
          onClose();
        }}
      />
    );
  }

  return (
    <div className="sheet-backdrop sheet-backdrop-top" onClick={onClose}>
      <div className="sheet sheet-fullscreen" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <h2>Add Exercise</h2>
          <button type="button" className="sheet-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="sheet-scroll-body">
          <>
            <input
              type="text"
              className="detail-input picker-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or tag (e.g. legs, core)"
              autoFocus
            />
            <div className="picker-list">
              {results.map((exercise) => {
                const alreadyAdded = excludeExerciseIds.includes(exercise.id);
                return (
                  <button
                    key={exercise.id}
                    type="button"
                    className="picker-list-item"
                    disabled={alreadyAdded}
                    onClick={() => {
                      onSelect(exercise.id);
                      onClose();
                    }}
                  >
                    <div className="picker-item-name">{exercise.name}</div>
                    {alreadyAdded ? (
                      <div className="picker-item-tags">Already in this workout</div>
                    ) : (
                      exercise.tags.length > 0 && <div className="picker-item-tags">{exercise.tags.join(", ")}</div>
                    )}
                  </button>
                );
              })}
              {results.length === 0 && trimmedQuery.length > 0 && (
                <div className="picker-no-match">
                  <div className="empty-state">No exercises match "{trimmedQuery}".</div>
                  <button type="button" className="builder-primary-btn" onClick={() => setMode("create")}>
                    Create "{trimmedQuery}" &amp; Add to Workout
                  </button>
                </div>
              )}
            </div>
          </>
        </div>
      </div>
    </div>
  );
}
