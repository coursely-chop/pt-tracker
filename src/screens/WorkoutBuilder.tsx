import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import ExercisePickerSheet from "../components/ExercisePickerSheet";
import { GymModeContext, Stepper } from "../components/EditModeSheet";
import { useData } from "../lib/DataContext";
import type { Superset, Workout, WorkoutProtocol } from "../types";

interface BuilderSlot {
  key: string;
  /** First id is the primary exercise; any further ids are alternates the
   * viewer can swipe to on Workout Overview (see .slot[data-swipe] there). */
  exerciseIds: string[];
}

interface BuilderSuperset {
  key: string;
  slots: BuilderSlot[];
}

const DEFAULT_PROTOCOL: WorkoutProtocol = {
  workingSets: 2,
  warmupSets: 1,
  restBetweenExercisesSec: { min: 15, max: 30 },
  restBetweenSupersetsSec: { min: 60, max: 90 },
  notes: "Complete all sets of a superset before moving on to the next superset.",
};

function newKey(): string {
  return crypto.randomUUID();
}

function toBuilderSupersets(workout: Workout): BuilderSuperset[] {
  return [...workout.supersets]
    .sort((a, b) => a.order - b.order)
    .map((superset) => ({
      key: newKey(),
      slots: [...superset.slots]
        .sort((a, b) => a.order - b.order)
        .map((slot) => ({ key: newKey(), exerciseIds: slot.exerciseIds })),
    }));
}

/** All exercise ids already used anywhere in the workout (primary or alternate,
 * in any superset) — what the exercise picker excludes, greyed out with
 * "Already in this workout," so the same exercise can't end up twice across
 * different supersets either, not just within one. */
function workoutExerciseIds(supersets: BuilderSuperset[]): string[] {
  return supersets.flatMap((s) => s.slots.flatMap((slot) => slot.exerciseIds));
}

/** A guided, single-scrolling-page flow mirroring the underlying structure directly:
 * a workout is a name + protocol + an ordered list of supersets, each holding an
 * ordered list of slots. A slot is a primary exercise plus optional alternates
 * (swipeable on Workout Overview) — added the same way, via the exercise picker,
 * scoped to that one slot. Reordering and removing use one consistent ↑/↓ +
 * × control cluster rather than drag-and-drop, consistent with everything else in
 * this app being hand-rolled without a gesture/drag library.
 *
 * Doubles as the editor for an existing workout (`/workouts/:workoutId/edit`) —
 * same builder, prefilled, so there's exactly one place this structure gets built
 * or changed rather than a second parallel editing UI. */
export default function WorkoutBuilder() {
  const { workoutId } = useParams<{ workoutId?: string }>();
  const [searchParams] = useSearchParams();
  const { getExercise, getWorkout, createWorkout, updateWorkout, deleteWorkout } = useData();
  const navigate = useNavigate();

  const isEditing = workoutId !== undefined;
  const existingWorkout = workoutId ? getWorkout(workoutId) : undefined;
  // Fixed for the life of the workout — there's no UI to convert one type to
  // the other, only to choose it at creation (via the Home Screen's active
  // tab, passed as ?type=gym) or inherit it when editing an existing one.
  const workoutType: Workout["type"] = existingWorkout?.type ?? (searchParams.get("type") === "gym" ? "gym" : "home");
  const workoutTypeLabel = workoutType === "gym" ? "Gym" : "Home";

  const [name, setName] = useState(() => existingWorkout?.name ?? "");
  const [supersets, setSupersets] = useState<BuilderSuperset[]>(() =>
    existingWorkout ? toBuilderSupersets(existingWorkout) : [{ key: newKey(), slots: [] }]
  );
  const [protocol, setProtocol] = useState<WorkoutProtocol>(
    () => existingWorkout?.structure.protocol ?? DEFAULT_PROTOCOL
  );
  const [dynamicStretching, setDynamicStretching] = useState(() => existingWorkout?.structure.dynamicStretching ?? "");
  const [pickerForSuperset, setPickerForSuperset] = useState<string | null>(null);
  const [pickerForAlternate, setPickerForAlternate] = useState<{ supersetKey: string; slotKey: string } | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (isEditing && !existingWorkout) {
    return (
      <div className="screen">
        <Link to="/" className="back-link">
          ← Home Workouts
        </Link>
        <p>Workout not found.</p>
      </div>
    );
  }

  const nonEmptySupersets = supersets.filter((s) => s.slots.length > 0);
  const canSave = name.trim().length > 0 && nonEmptySupersets.length > 0;

  function addSuperset() {
    setSupersets([...supersets, { key: newKey(), slots: [] }]);
  }

  function removeSuperset(key: string) {
    setSupersets(supersets.filter((s) => s.key !== key));
  }

  function moveSuperset(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= supersets.length) return;
    const next = [...supersets];
    [next[index], next[target]] = [next[target], next[index]];
    setSupersets(next);
  }

  function addSlot(supersetKey: string, exerciseId: string) {
    setSupersets(
      supersets.map((s) =>
        s.key === supersetKey ? { ...s, slots: [...s.slots, { key: newKey(), exerciseIds: [exerciseId] }] } : s
      )
    );
  }

  function addAlternate(supersetKey: string, slotKey: string, exerciseId: string) {
    setSupersets(
      supersets.map((s) =>
        s.key === supersetKey
          ? {
              ...s,
              slots: s.slots.map((sl) =>
                sl.key === slotKey ? { ...sl, exerciseIds: [...sl.exerciseIds, exerciseId] } : sl
              ),
            }
          : s
      )
    );
  }

  function removeAlternate(supersetKey: string, slotKey: string, exerciseId: string) {
    setSupersets(
      supersets.map((s) =>
        s.key === supersetKey
          ? {
              ...s,
              slots: s.slots.map((sl) =>
                sl.key === slotKey ? { ...sl, exerciseIds: sl.exerciseIds.filter((id) => id !== exerciseId) } : sl
              ),
            }
          : s
      )
    );
  }

  function removeSlot(supersetKey: string, slotKey: string) {
    setSupersets(
      supersets.map((s) => (s.key === supersetKey ? { ...s, slots: s.slots.filter((sl) => sl.key !== slotKey) } : s))
    );
  }

  function moveSlot(supersetKey: string, index: number, dir: -1 | 1) {
    setSupersets(
      supersets.map((s) => {
        if (s.key !== supersetKey) return s;
        const target = index + dir;
        if (target < 0 || target >= s.slots.length) return s;
        const next = [...s.slots];
        [next[index], next[target]] = [next[target], next[index]];
        return { ...s, slots: next };
      })
    );
  }

  function updateProtocol(updates: Partial<WorkoutProtocol>) {
    setProtocol({ ...protocol, ...updates });
  }

  function handleSave() {
    if (!canSave) return;
    const finalSupersets: Superset[] = nonEmptySupersets.map((s, i) => ({
      order: i + 1,
      slots: s.slots.map((sl, j) => ({ order: j + 1, exerciseIds: sl.exerciseIds })),
    }));
    const input = {
      name: name.trim(),
      type: workoutType,
      dynamicStretching: dynamicStretching.trim(),
      protocol,
      supersets: finalSupersets,
    };
    if (isEditing && workoutId) {
      updateWorkout(workoutId, input);
      navigate(`/workouts/${workoutId}`);
    } else {
      createWorkout(input);
      navigate("/");
    }
  }

  function handleDelete() {
    if (!workoutId) return;
    deleteWorkout(workoutId);
    navigate("/");
  }

  const backTo = isEditing && workoutId ? `/workouts/${workoutId}` : "/";
  const backLabel = isEditing && existingWorkout ? `← ${existingWorkout.name}` : `← ${workoutTypeLabel} Workouts`;

  return (
    <div className="screen">
      <Link to={backTo} className="back-link">
        {backLabel}
      </Link>
      <input
        type="text"
        className="screen-title screen-title-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={`New ${workoutTypeLabel} Workout`}
        aria-label="Workout name"
        autoFocus={!isEditing}
      />

      {supersets.map((superset, si) => (
        <div key={superset.key} className="builder-superset">
          <div className="builder-superset-header">
            <div className="superset-label">Superset {si + 1}</div>
            <div className="builder-header-controls">
              <div className="swipe-cluster">
                <button
                  type="button"
                  className="swipe-cluster-btn"
                  onClick={() => moveSuperset(si, -1)}
                  disabled={si === 0}
                  aria-label="Move superset up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="swipe-cluster-btn"
                  onClick={() => moveSuperset(si, 1)}
                  disabled={si === supersets.length - 1}
                  aria-label="Move superset down"
                >
                  ↓
                </button>
              </div>
              <button
                type="button"
                className="cue-remove"
                onClick={() => removeSuperset(superset.key)}
                aria-label={`Remove Superset ${si + 1}`}
              >
                ×
              </button>
            </div>
          </div>

          {superset.slots.map((slot, sli) => {
            const [primaryId, ...alternateIds] = slot.exerciseIds;
            const exercise = getExercise(primaryId);
            return (
              <div key={slot.key} className="builder-slot-group">
                <div className="builder-slot-row">
                  <div className="builder-slot-name">{exercise?.name ?? "Unknown exercise"}</div>
                  <div className="builder-slot-controls">
                    <div className="swipe-cluster">
                      <button
                        type="button"
                        className="swipe-cluster-btn"
                        onClick={() => moveSlot(superset.key, sli, -1)}
                        disabled={sli === 0}
                        aria-label="Move exercise up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="swipe-cluster-btn"
                        onClick={() => moveSlot(superset.key, sli, 1)}
                        disabled={sli === superset.slots.length - 1}
                        aria-label="Move exercise down"
                      >
                        ↓
                      </button>
                    </div>
                    <button
                      type="button"
                      className="cue-remove"
                      onClick={() => removeSlot(superset.key, slot.key)}
                      aria-label={`Remove ${exercise?.name ?? "exercise"}`}
                    >
                      ×
                    </button>
                  </div>
                </div>

                {alternateIds.map((altId) => {
                  const alt = getExercise(altId);
                  return (
                    <div key={altId} className="builder-alternate-row">
                      <div className="builder-alternate-name">↳ {alt?.name ?? "Unknown exercise"}</div>
                      <button
                        type="button"
                        className="cue-remove"
                        onClick={() => removeAlternate(superset.key, slot.key, altId)}
                        aria-label={`Remove alternate ${alt?.name ?? "exercise"}`}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}

                <button
                  type="button"
                  className="add-note-trigger builder-add-alternate-btn"
                  onClick={() => setPickerForAlternate({ supersetKey: superset.key, slotKey: slot.key })}
                >
                  + Add Alternate
                </button>
              </div>
            );
          })}

          <button type="button" className="builder-primary-btn" onClick={() => setPickerForSuperset(superset.key)}>
            + Add Exercise
          </button>
        </div>
      ))}

      <button type="button" className="builder-secondary-btn builder-add-superset-btn" onClick={addSuperset}>
        + Add Superset
      </button>

      <details className="detail-section builder-protocol">
        <summary>Protocol</summary>
        <div className="side-detail-grid">
          <Stepper
            label="Working Sets"
            value={protocol.workingSets}
            unit="sets"
            step={1}
            min={1}
            onChange={(v) => updateProtocol({ workingSets: v })}
          />
          <Stepper
            label="Warmup Sets"
            value={protocol.warmupSets}
            unit="sets"
            step={1}
            min={0}
            onChange={(v) => updateProtocol({ warmupSets: v })}
          />
        </div>
        <div className="side-detail-grid">
          <Stepper
            label="Rest Within Superset (min)"
            value={protocol.restBetweenExercisesSec.min}
            unit="sec"
            step={5}
            min={0}
            onChange={(v) => updateProtocol({ restBetweenExercisesSec: { ...protocol.restBetweenExercisesSec, min: v } })}
          />
          <Stepper
            label="Rest Within Superset (max)"
            value={protocol.restBetweenExercisesSec.max}
            unit="sec"
            step={5}
            min={0}
            onChange={(v) => updateProtocol({ restBetweenExercisesSec: { ...protocol.restBetweenExercisesSec, max: v } })}
          />
        </div>
        <div className="side-detail-grid">
          <Stepper
            label="Rest Between Supersets (min)"
            value={protocol.restBetweenSupersetsSec.min}
            unit="sec"
            step={5}
            min={0}
            onChange={(v) => updateProtocol({ restBetweenSupersetsSec: { ...protocol.restBetweenSupersetsSec, min: v } })}
          />
          <Stepper
            label="Rest Between Supersets (max)"
            value={protocol.restBetweenSupersetsSec.max}
            unit="sec"
            step={5}
            min={0}
            onChange={(v) => updateProtocol({ restBetweenSupersetsSec: { ...protocol.restBetweenSupersetsSec, max: v } })}
          />
        </div>
        <div className="detail-field">
          <div className="slider-label">Protocol Notes</div>
          <input
            type="text"
            className="detail-input"
            value={protocol.notes}
            onChange={(e) => updateProtocol({ notes: e.target.value })}
          />
        </div>
      </details>

      <div className="detail-field">
        <div className="slider-label">Dynamic Stretching</div>
        <textarea
          className="detail-textarea"
          value={dynamicStretching}
          onChange={(e) => setDynamicStretching(e.target.value)}
          placeholder="Optional — reference or list stretches"
          rows={2}
        />
      </div>

      <button type="button" className="save-btn" disabled={!canSave} onClick={handleSave}>
        {isEditing ? "Save Changes" : "Save Workout"}
      </button>

      {isEditing &&
        (confirmingDelete ? (
          <div className="discard-confirm builder-delete-confirm">
            <div className="discard-confirm-text">Delete this workout? This can't be undone.</div>
            <div className="discard-confirm-actions">
              <button type="button" className="discard-cancel-btn" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </button>
              <button type="button" className="discard-btn" onClick={handleDelete}>
                Delete
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="builder-delete-trigger" onClick={() => setConfirmingDelete(true)}>
            Delete Workout
          </button>
        ))}

      {pickerForSuperset && (
        <GymModeContext.Provider value={workoutType === "gym"}>
          <ExercisePickerSheet
            onClose={() => setPickerForSuperset(null)}
            onSelect={(exerciseId) => addSlot(pickerForSuperset, exerciseId)}
            excludeExerciseIds={workoutExerciseIds(supersets)}
          />
        </GymModeContext.Provider>
      )}

      {pickerForAlternate && (
        <GymModeContext.Provider value={workoutType === "gym"}>
          <ExercisePickerSheet
            onClose={() => setPickerForAlternate(null)}
            onSelect={(exerciseId) =>
              addAlternate(pickerForAlternate.supersetKey, pickerForAlternate.slotKey, exerciseId)
            }
            excludeExerciseIds={workoutExerciseIds(supersets)}
          />
        </GymModeContext.Provider>
      )}
    </div>
  );
}
