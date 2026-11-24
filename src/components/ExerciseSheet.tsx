import { useState } from "react";
import {
  GymModeContext,
  LoadEditor,
  LoadKindPicker,
  REPS_STEP,
  SideEditor,
  Stepper,
  cloneLoad,
  convertLoad,
  formatLoadPreview,
} from "./LoadControls";
import { computeWarmupLoad, localDateISO } from "../lib/format";
import { useData, type ExerciseUpdate } from "../lib/DataContext";
import type { Exercise, ExerciseTarget, Load, ProgressionEntry, SideTarget, WarmupOverride } from "../types";

interface FormState {
  name: string;
  asymmetric: boolean;
  reps: number;
  load: Load;
  leftReps: number;
  rightReps: number;
  leftLoad: Load;
  rightLoad: Load;
  warmupEnabled: boolean;
  warmupReps: number;
  warmupLinked: boolean;
  warmupOverrideLoad: Load;
  warmupOverrideLeftLoad: Load;
  warmupOverrideRightLoad: Load;
}

const BODYWEIGHT: Load = { kind: "bodyweight" };

/** What a brand-new exercise starts as: 10 reps of bodyweight, warmup on and
 * matching working. Picking a resistance type and weight is the whole point of
 * opening the sheet, so there's nothing smarter to default to. */
export function makeDraftExercise(name: string): Exercise {
  const target: ExerciseTarget = {
    repRange: { min: 10, max: 10 },
    perSide: false,
    reps: 10,
    load: BODYWEIGHT,
    sides: null,
  };
  return {
    id: "",
    name,
    targets: { home: target, gym: target },
    warmupReps: 10,
    warmupLoads: { home: null, gym: null },
    progressionRule: null,
    cues: [],
    tags: [],
    links: {},
    progression: [],
  };
}

function buildInitialState(
  exercise: Exercise,
  isGym: boolean,
  equipment: Parameters<typeof computeWarmupLoad>[1]
): FormState {
  const bucket = isGym ? "gym" : "home";
  const target = exercise.targets[bucket];
  const warmupLoad = exercise.warmupLoads[bucket];
  const sides = target.sides;
  const asymmetric = sides != null;
  const reps = target.reps ?? target.repRange.min;

  let warmupOverrideLoad: Load = BODYWEIGHT;
  let warmupOverrideLeftLoad: Load = BODYWEIGHT;
  let warmupOverrideRightLoad: Load = BODYWEIGHT;
  if (sides) {
    const override = warmupLoad && "left" in warmupLoad ? warmupLoad : null;
    warmupOverrideLeftLoad = override ? override.left : computeWarmupLoad(sides.left.load, equipment, isGym);
    warmupOverrideRightLoad = override ? override.right : computeWarmupLoad(sides.right.load, equipment, isGym);
  } else {
    const override = warmupLoad && !("left" in warmupLoad) ? warmupLoad : null;
    warmupOverrideLoad = override ?? computeWarmupLoad(target.load, equipment, isGym);
  }

  return {
    name: exercise.name,
    asymmetric,
    reps,
    load: cloneLoad(target.load ?? BODYWEIGHT),
    leftReps: sides ? sides.left.reps : 1,
    rightReps: sides ? sides.right.reps : 1,
    leftLoad: cloneLoad(sides ? sides.left.load : BODYWEIGHT),
    rightLoad: cloneLoad(sides ? sides.right.load : BODYWEIGHT),
    warmupEnabled: exercise.warmupReps != null,
    warmupReps: exercise.warmupReps ?? (sides ? Math.min(sides.left.reps, sides.right.reps) : reps),
    warmupLinked: warmupLoad == null,
    warmupOverrideLoad: cloneLoad(warmupOverrideLoad),
    warmupOverrideLeftLoad: cloneLoad(warmupOverrideLeftLoad),
    warmupOverrideRightLoad: cloneLoad(warmupOverrideRightLoad),
  };
}

/** JSON with sorted keys, so two loads that mean the same thing compare equal
 * regardless of the order their fields were written in. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(obj[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function targetKey(t: ExerciseTarget): string {
  return stable([t.reps, t.load, t.sides]);
}

interface ExerciseSheetProps {
  exercise: Exercise;
  /** Which kind of workout this was opened from — weights and warmup are
   * saved for that kind only (Home and Gym are independent), while the name
   * is shared. */
  isGym: boolean;
  /** A brand-new exercise: nothing is saved until Save, and no history entry
   * is written for its first weights. */
  isNew?: boolean;
  onSave: (update: ExerciseUpdate) => void;
  onClose: () => void;
}

/** The one place an exercise is edited — name, resistance type, warmup,
 * working weights — whether that's an existing exercise tapped from a workout
 * or a new one being created. It used to be three separate screens (Edit
 * Mode, Edit Details behind the exercise title, and a New Exercise form that
 * duplicated Edit Mode), and "which one do I open to change this?" had no
 * obvious answer. Mounted fresh per exercise (callers key it), so form state
 * is seeded once from the exercise rather than synced back from it. */
export default function ExerciseSheet({ exercise, isGym, isNew = false, onSave, onClose }: ExerciseSheetProps) {
  const { equipment } = useData();
  const bucket = isGym ? "gym" : "home";

  const [init] = useState(() => buildInitialState(exercise, isGym, equipment));
  const [initialSnapshot] = useState(() => stable(init));

  const [name, setName] = useState(init.name);
  const [asymmetric, setAsymmetric] = useState(init.asymmetric);
  const [reps, setReps] = useState(init.reps);
  const [load, setLoad] = useState<Load>(init.load);
  const [leftReps, setLeftReps] = useState(init.leftReps);
  const [rightReps, setRightReps] = useState(init.rightReps);
  const [leftLoad, setLeftLoad] = useState<Load>(init.leftLoad);
  const [rightLoad, setRightLoad] = useState<Load>(init.rightLoad);
  const [leftTempo] = useState(exercise.targets[bucket].sides?.left.tempo);
  const [rightTempo] = useState(exercise.targets[bucket].sides?.right.tempo);

  // Null (linked) means warmup is always computed live from whatever load/leftLoad/
  // rightLoad above currently is — that's the "accelerator": adjust working, warmup
  // just follows. Unchecking "Match Working" below sets these instead, letting
  // warmup be edited the same way as working: its own Load, independent of it.
  const [warmupLinked, setWarmupLinked] = useState(init.warmupLinked);
  const [warmupOverrideLoad, setWarmupOverrideLoad] = useState<Load>(init.warmupOverrideLoad);
  const [warmupOverrideLeftLoad, setWarmupOverrideLeftLoad] = useState<Load>(init.warmupOverrideLeftLoad);
  const [warmupOverrideRightLoad, setWarmupOverrideRightLoad] = useState<Load>(init.warmupOverrideRightLoad);
  const [warmupReps, setWarmupReps] = useState(init.warmupReps);
  const [warmupEnabled, setWarmupEnabled] = useState(init.warmupEnabled);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  const isDirty =
    stable({
      name,
      asymmetric,
      reps,
      load,
      leftReps,
      rightReps,
      leftLoad,
      rightLoad,
      warmupEnabled,
      warmupReps,
      warmupLinked,
      warmupOverrideLoad,
      warmupOverrideLeftLoad,
      warmupOverrideRightLoad,
    }) !== initialSnapshot;
  const canSave = name.trim().length > 0;

  function requestClose() {
    if (isDirty) setConfirmingDiscard(true);
    else onClose();
  }

  // The resistance *type* (Free Weight/Machine/Band/Loop Band/Bodyweight) is a
  // property of the exercise as a whole, not something that varies between
  // its working target and warmup, or between left and right — a "Leg Press
  // Machine" is a machine exercise, full stop. So one picker near the top
  // changes all six Load slots at once, converting each from its own current
  // value (not overwriting them all from a single shared value) so a
  // same-shape field like lbs still carries over per side.
  function handleKindChange(kind: Load["kind"]) {
    setLoad(convertLoad(load, kind));
    setLeftLoad(convertLoad(leftLoad, kind));
    setRightLoad(convertLoad(rightLoad, kind));
    setWarmupOverrideLoad(convertLoad(warmupOverrideLoad, kind));
    setWarmupOverrideLeftLoad(convertLoad(warmupOverrideLeftLoad, kind));
    setWarmupOverrideRightLoad(convertLoad(warmupOverrideRightLoad, kind));
  }

  // Unchecking "Match Working" starts the independent warmup from what the
  // linked preview is showing right now — computed from the working values
  // as they currently are in this sheet, not as they were when it opened —
  // so it can be nudged with a tap.
  function handleWarmupLinkedChange(linked: boolean) {
    if (!linked) {
      setWarmupOverrideLoad(computeWarmupLoad(load, equipment, isGym));
      setWarmupOverrideLeftLoad(computeWarmupLoad(leftLoad, equipment, isGym));
      setWarmupOverrideRightLoad(computeWarmupLoad(rightLoad, equipment, isGym));
    }
    setWarmupLinked(linked);
  }

  function handleAsymmetricToggle(checked: boolean) {
    if (checked) {
      if (exercise.targets[bucket].sides == null) {
        // First time splitting: start both sides from the current combined value.
        setLeftLoad(cloneLoad(load));
        setRightLoad(cloneLoad(load));
        setLeftReps(reps);
        setRightReps(reps);
        setWarmupOverrideLeftLoad(cloneLoad(warmupOverrideLoad));
        setWarmupOverrideRightLoad(cloneLoad(warmupOverrideLoad));
      }
    } else {
      setWarmupOverrideLoad(cloneLoad(warmupOverrideLeftLoad));
      // Collapsing back to one combined value: the combined state (`load`/`reps`)
      // is never populated for an exercise that started asymmetric, so carry the
      // left side forward instead of falling back to whatever `load` held.
      setLoad(cloneLoad(leftLoad));
      setReps(leftReps);
    }
    setAsymmetric(checked);
  }

  function handleSave() {
    if (!canSave) return;
    const date = localDateISO();
    let target: ExerciseTarget;
    const entries: ProgressionEntry[] = [];

    if (asymmetric) {
      const sides = {
        left: { load: leftLoad, reps: leftReps, tempo: leftTempo } as SideTarget,
        right: { load: rightLoad, reps: rightReps, tempo: rightTempo } as SideTarget,
      };
      target = { ...exercise.targets[bucket], perSide: true, reps: null, load: null, sides };
      entries.push({ date, load: leftLoad, reps: leftReps, note: null, side: "left", venue: bucket });
      entries.push({ date, load: rightLoad, reps: rightReps, note: null, side: "right", venue: bucket });
    } else {
      target = { ...exercise.targets[bucket], reps, load, sides: null };
      entries.push({ date, load, reps, note: null, venue: bucket });
    }

    const warmupLoad: WarmupOverride = !warmupEnabled
      ? null
      : warmupLinked
        ? null
        : asymmetric
          ? { left: warmupOverrideLeftLoad, right: warmupOverrideRightLoad }
          : warmupOverrideLoad;

    onSave({
      name: name.trim(),
      target,
      // History records weight/reps changes only — renaming, or tweaking just
      // the warmup, shouldn't add a point to the chart. A new exercise has no
      // "change" to record yet either.
      entries: isNew || targetKey(target) === targetKey(exercise.targets[bucket]) ? [] : entries,
      warmupLoad,
      // This checkbox is this sheet's own way to turn warmup off (or, from an
      // exercise with none, back on) — reps only means something when it's on.
      warmupReps: warmupEnabled ? warmupReps : null,
    });
  }

  if (confirmingDiscard) {
    return (
      <div className="sheet-backdrop" onClick={requestClose}>
        <div className="sheet" onClick={(e) => e.stopPropagation()}>
          <div className="discard-confirm">
            <div className="discard-confirm-text">Save Unsaved Changes?</div>
            <div className="discard-confirm-actions">
              <button type="button" className="confirm-discard-btn" onClick={onClose}>
                Discard
              </button>
              <button type="button" className="confirm-save-btn" onClick={handleSave} disabled={!canSave}>
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <GymModeContext.Provider value={isGym}>
      <div className="sheet-backdrop" onClick={requestClose}>
        <div className="sheet" onClick={(e) => e.stopPropagation()}>
          <div className="sheet-header">
            <input
              type="text"
              className="detail-input sheet-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Exercise name"
              aria-label="Exercise name"
              autoFocus={isNew}
            />
            <button type="button" className="sheet-close" onClick={requestClose} aria-label="Close">
              ×
            </button>
          </div>
          <div className="detail-hint sheet-scope-hint">
            Weights and warmup below are for {isGym ? "Gym" : "Home"} workouts only.
          </div>

          <div className="edit-mode-section">
            <div className="slider-label">Resistance Type</div>
            <LoadKindPicker selectedKind={asymmetric ? leftLoad.kind : load.kind} onSelect={handleKindChange} />
          </div>

          <div className="edit-mode-section">
            <div className="warmup-enabled-row">
              <div className="slider-label">Warmup</div>
              <input
                type="checkbox"
                checked={warmupEnabled}
                onChange={(e) => setWarmupEnabled(e.target.checked)}
                aria-label="Exercise has a warmup"
              />
            </div>

            {!warmupEnabled ? (
              <div className="set-line-none">None required</div>
            ) : (
              <>
                <div className="edit-mode-section-header">
                  <Stepper label="Warmup Reps" value={warmupReps} unit="reps" min={1} step={REPS_STEP} onChange={setWarmupReps} />
                  <label className="toggle-row toggle-row-inline">
                    <input
                      type="checkbox"
                      checked={warmupLinked}
                      onChange={(e) => handleWarmupLinkedChange(e.target.checked)}
                    />
                    Match Working (50-75%)
                  </label>
                </div>

                {asymmetric ? (
                  <div className="sides-editor">
                    <div className="side-editor">
                      <div className="side-editor-label">Left</div>
                      {warmupLinked ? (
                        <div className="load-editor-preview">
                          {formatLoadPreview(computeWarmupLoad(leftLoad, equipment, isGym))}
                        </div>
                      ) : (
                        <LoadEditor load={warmupOverrideLeftLoad} setLoad={setWarmupOverrideLeftLoad} />
                      )}
                    </div>
                    <div className="side-editor">
                      <div className="side-editor-label">Right</div>
                      {warmupLinked ? (
                        <div className="load-editor-preview">
                          {formatLoadPreview(computeWarmupLoad(rightLoad, equipment, isGym))}
                        </div>
                      ) : (
                        <LoadEditor load={warmupOverrideRightLoad} setLoad={setWarmupOverrideRightLoad} />
                      )}
                    </div>
                  </div>
                ) : warmupLinked ? (
                  <div className="load-editor-preview">{formatLoadPreview(computeWarmupLoad(load, equipment, isGym))}</div>
                ) : (
                  <LoadEditor load={warmupOverrideLoad} setLoad={setWarmupOverrideLoad} />
                )}
              </>
            )}
          </div>

          <div className="edit-mode-section">
            <div className="slider-label">Working</div>

            <label className="toggle-row">
              <input
                type="checkbox"
                checked={asymmetric}
                onChange={(e) => handleAsymmetricToggle(e.target.checked)}
              />
              Left &amp; Right differ
            </label>

            {asymmetric ? (
              <div className="sides-editor">
                <SideEditor label="Left" reps={leftReps} setReps={setLeftReps} load={leftLoad} setLoad={setLeftLoad} />
                <SideEditor
                  label="Right"
                  reps={rightReps}
                  setReps={setRightReps}
                  load={rightLoad}
                  setLoad={setRightLoad}
                />
              </div>
            ) : (
              <>
                <LoadEditor load={load} setLoad={setLoad} />
                <Stepper value={reps} unit="reps" min={1} step={REPS_STEP} onChange={setReps} />
              </>
            )}
          </div>

          <button type="button" className="save-btn" onClick={handleSave} disabled={!canSave}>
            {isNew ? "Add Exercise" : "Save"}
          </button>
        </div>
      </div>
    </GymModeContext.Provider>
  );
}

/** Opens ExerciseSheet for whichever existing exercise the app has asked to
 * edit (tapping a workout's warmup/working row anywhere). Keyed by exercise
 * and venue so every field mounts fresh each time it opens. */
export function EditExerciseHost() {
  const { editingExerciseId, editingExerciseIsGym, closeEditMode, getExercise, updateExercise } = useData();
  const exercise = editingExerciseId ? getExercise(editingExerciseId) : undefined;
  if (!exercise) return null;
  return (
    <ExerciseSheet
      key={`${exercise.id}:${editingExerciseIsGym}`}
      exercise={exercise}
      isGym={editingExerciseIsGym}
      onSave={(update) => {
        updateExercise(exercise.id, editingExerciseIsGym, update);
        closeEditMode();
      }}
      onClose={closeEditMode}
    />
  );
}
