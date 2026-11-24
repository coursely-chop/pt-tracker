import { useContext, useState } from "react";
import ExerciseIcon from "./ExerciseIcon";
import ExerciseSheet, { makeDraftExercise } from "./ExerciseSheet";
import { GymModeContext } from "./LoadControls";
import { resolveExerciseIcon } from "../lib/exerciseIcons";
import { searchExercises } from "../lib/exerciseSearch";
import { useBodyScrollLock } from "../lib/useBodyScrollLock";
import { useData } from "../lib/DataContext";

interface ExercisePickerSheetProps {
  onClose: () => void;
  /** Everything chosen (ticked, and/or newly created), in the order picked —
   * delivered once, so the caller can add them all in one update. */
  onSelect: (exerciseIds: string[]) => void;
  /** Exercise ids already in the workout this picker is adding to — rendered
   * disabled rather than hidden, so it's clear *why* they can't be tapped again
   * instead of the library appearing to have shrunk. */
  excludeExerciseIds: string[];
}

/** Reached when adding exercises to a superset (or a slot's alternates): search
 * the library by name or tag and tick as many as you want, then add them all
 * at once — adding one at a time meant reopening this for every exercise.
 * Creating a brand-new exercise is always an option too (not only once a
 * search comes up empty), opens the same exercise sheet used to edit one, and
 * joins whatever's already ticked. Full-screen, top-aligned takeover (not a
 * bottom sheet) since the results can run long; locks background scroll for as
 * long as it's open, so it isn't a second scroll area fighting the page. */
export default function ExercisePickerSheet({ onClose, onSelect, excludeExerciseIds }: ExercisePickerSheetProps) {
  const { exercises, createExercise } = useData();
  const isGym = useContext(GymModeContext);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  useBodyScrollLock();

  const results = searchExercises(exercises, query);
  const trimmedQuery = query.trim();
  const hasExactMatch = exercises.some((e) => e.name.toLowerCase() === trimmedQuery.toLowerCase());

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  }

  function finish(ids: string[]) {
    onSelect(ids);
    onClose();
  }

  // Creating a new exercise is the same sheet used to edit one — name,
  // resistance, warmup, working — not a second, separately-maintained form.
  if (creating) {
    return (
      <ExerciseSheet
        isNew
        isGym={isGym}
        exercise={makeDraftExercise(trimmedQuery)}
        onClose={() => setCreating(false)}
        onSave={(update) => {
          const id = createExercise({
            name: update.name,
            target: update.target,
            tags: [],
            warmupReps: update.warmupReps,
            warmupLoad: update.warmupLoad,
          });
          finish([...selected, id]);
        }}
      />
    );
  }

  return (
    <div className="sheet-backdrop sheet-backdrop-top" onClick={onClose}>
      <div className="sheet sheet-fullscreen" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <h2>Add Exercises</h2>
          <button type="button" className="sheet-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="sheet-scroll-body">
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
              const isSelected = selected.includes(exercise.id);
              return (
                <button
                  key={exercise.id}
                  type="button"
                  className={`picker-list-item${isSelected ? " selected" : ""}`}
                  disabled={alreadyAdded}
                  aria-pressed={isSelected}
                  onClick={() => toggle(exercise.id)}
                >
                  <span className="picker-check" aria-hidden="true">
                    {isSelected ? "✓" : ""}
                  </span>
                  <ExerciseIcon icon={resolveExerciseIcon(exercise, isGym ? "gym" : "home")} size={22} className="picker-item-icon" />
                  <span className="picker-item-text">
                    <div className="picker-item-name">{exercise.name}</div>
                    {alreadyAdded ? (
                      <div className="picker-item-tags">Already in this workout</div>
                    ) : (
                      exercise.tags.length > 0 && <div className="picker-item-tags">{exercise.tags.join(", ")}</div>
                    )}
                  </span>
                </button>
              );
            })}
            {results.length === 0 && trimmedQuery.length > 0 && (
              <div className="empty-state picker-empty">No exercises match "{trimmedQuery}".</div>
            )}
            {!hasExactMatch && (
              <button type="button" className="picker-create-row" onClick={() => setCreating(true)}>
                + {trimmedQuery ? `Create "${trimmedQuery}"` : "Create a new exercise"}
              </button>
            )}
          </div>
        </div>

        <div className="picker-footer">
          <button
            type="button"
            className="save-btn"
            disabled={selected.length === 0}
            onClick={() => finish(selected)}
          >
            {selected.length === 0
              ? "Select exercises to add"
              : `Add ${selected.length} ${selected.length === 1 ? "exercise" : "exercises"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
