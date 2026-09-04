import { createContext, useContext, useEffect, useState } from "react";
import { capitalize, computeWarmupLoad, todayISO } from "../lib/format";
import { BAND_COLORS, BAND_HEX, BAND_WEIGHTS, LOOP_BAND_HEX, LOOP_BAND_STRENGTHS, computeBandWeight } from "../lib/equipment";
import { useData } from "../lib/DataContext";
import type { BandLoad, Exercise, ExerciseTarget, Load, LoopBandLoad, ProgressionEntry, SideTarget } from "../types";

/** Read-only text for the "Match Working" preview — no band dots needed here,
 * unlike the glanceable views (Workout Overview, Movement Detail); a plain
 * label is enough for a value you can't currently touch. */
export function formatLoadPreview(load: Load): string {
  if (load.kind === "bodyweight") return "Bodyweight";
  if (load.kind === "freeWeight") return `${load.lbs} lbs`;
  if (load.kind === "loopBand") return load.strengths.map(capitalize).join(" & ") || "—";
  const weight = computeBandWeight(load.bands);
  const label = load.bands.map(capitalize).join(" & ");
  return weight > 0 ? `${label} (${weight} lbs)` : label || "—";
}

export const REPS_STEP = 1;

/** True while editing an exercise reached from a gym workout — set by
 * WorkoutBuilder (creating/adding exercises) and EditModeSheet itself
 * (editing an existing target), both of which know which workout is in
 * play even though LoadEditor, several layers down, doesn't. LoadEditor
 * reads this to skip the home-equipment stepper restriction outright,
 * regardless of the global Equipment setting — a gym has a full rack. */
export const GymModeContext = createContext(false);

/** Real dumbbells don't jump in even intervals at the light end (a 3 lb rehab
 * weight sits between bodyweight and 5), so the weight stepper walks this
 * fixed sequence — 0 (bodyweight), 3, 5, then a plain 2.5 lb ladder — rather
 * than doing arithmetic by a flat step. Capped at 300 lbs, comfortably past
 * anything a home stepper needs to reach. */
export function buildWeightSequence(includeBodyweight = true): number[] {
  const sequence = includeBodyweight ? [0, 3, 5] : [3, 5];
  for (let w = 7.5; w <= 300; w += 2.5) sequence.push(w);
  return sequence;
}

function cloneLoad(load: Load): Load {
  return JSON.parse(JSON.stringify(load));
}

function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function stepSequence(value: number, sequence: number[], direction: 1 | -1): number {
  if (direction === 1) return sequence.find((v) => v > value) ?? value;
  for (let i = sequence.length - 1; i >= 0; i--) {
    if (sequence[i] < value) return sequence[i];
  }
  return sequence[0];
}

interface StepperProps {
  label?: string;
  value: number;
  unit: string;
  step: number;
  min?: number;
  onChange: (value: number) => void;
  /** Overrides the default "{value} {unit}" display — e.g. showing "Bodyweight"
   * at 0 instead of "0 lbs" — without teaching Stepper itself about load kinds. */
  formatValue?: (value: number) => string;
  /** Bigger buttons for a standalone, deliberate action (e.g. Equipment's "add
   * a new weight" flow) — the default size is tuned for a sheet already dense
   * with controls, where this one is the only thing on the screen. */
  large?: boolean;
  /** When set, +/- walk this ascending list of values instead of doing
   * arithmetic by `step`/`min` — the weight stepper's non-uniform sequence,
   * or an owned-equipment list. Takes over decrement/increment/disabled
   * entirely; `step`/`min` are ignored while this is set. */
  sequence?: number[];
}

/** Gains here are incremental by design (one tap per step or sequence entry) —
 * every tap moves exactly one notch, so there's no drag-to-an-arbitrary-position
 * control to get wrong. The value stays centered; − and + sit at each end. */
export function Stepper({ label, value, unit, step, min = 0, onChange, formatValue, large, sequence }: StepperProps) {
  const atFloor = sequence ? value <= sequence[0] : value <= min;
  const decrement = () =>
    onChange(sequence ? stepSequence(value, sequence, -1) : Math.max(min, roundToStep(value - step, step)));
  const increment = () => onChange(sequence ? stepSequence(value, sequence, 1) : roundToStep(value + step, step));

  return (
    <div className="stepper-field">
      {label && <div className="slider-label">{label}</div>}
      <div className={`stepper-row${large ? " stepper-row-lg" : ""}`}>
        <button
          type="button"
          className={`stepper-btn${large ? " stepper-btn-lg" : ""}`}
          onClick={decrement}
          disabled={atFloor}
          aria-label={`Decrease ${label ?? unit}`}
        >
          −
        </button>
        <div className={`stepper-value${large ? " stepper-value-lg" : ""}`}>
          {formatValue ? formatValue(value) : `${value} ${unit}`}
        </div>
        <button
          type="button"
          className={`stepper-btn${large ? " stepper-btn-lg" : ""}`}
          onClick={increment}
          aria-label={`Increase ${label ?? unit}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

interface EditSnapshot {
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

export default function EditModeSheet() {
  const { editingExerciseId, editingExerciseIsGym, closeEditMode, getExercise, updateExerciseTarget, equipment } =
    useData();
  const exercise = editingExerciseId ? getExercise(editingExerciseId) : undefined;

  const [asymmetric, setAsymmetric] = useState(false);
  const [reps, setReps] = useState(1);
  const [load, setLoad] = useState<Load>({ kind: "bodyweight" });
  const [leftReps, setLeftReps] = useState(1);
  const [rightReps, setRightReps] = useState(1);
  const [leftLoad, setLeftLoad] = useState<Load>({ kind: "bodyweight" });
  const [rightLoad, setRightLoad] = useState<Load>({ kind: "bodyweight" });
  const [leftTempo, setLeftTempo] = useState<string | undefined>();
  const [rightTempo, setRightTempo] = useState<string | undefined>();

  // Null (linked) means warmup is always computed live from whatever load/leftLoad/
  // rightLoad above currently is — that's the "accelerator": adjust working, warmup
  // just follows. Unchecking "Match Working" below sets these instead, letting
  // warmup be edited the same way as working: its own Load, independent of it.
  const [warmupLinked, setWarmupLinked] = useState(true);
  const [warmupOverrideLoad, setWarmupOverrideLoad] = useState<Load>({ kind: "bodyweight" });
  const [warmupOverrideLeftLoad, setWarmupOverrideLeftLoad] = useState<Load>({ kind: "bodyweight" });
  const [warmupOverrideRightLoad, setWarmupOverrideRightLoad] = useState<Load>({ kind: "bodyweight" });
  const [warmupReps, setWarmupReps] = useState(1);
  const [warmupEnabled, setWarmupEnabled] = useState(true);
  const [initialSnapshot, setInitialSnapshot] = useState("");
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  // Re-initialize form state only when a (possibly different) exercise is opened,
  // not on every subsequent data write elsewhere in the app. Values are computed
  // into locals first (not read back from state, which wouldn't be updated yet
  // within this same effect run) so the same values can seed both the form
  // fields and the dirty-tracking snapshot below.
  useEffect(() => {
    if (!exercise) return;
    const { target, warmupLoad } = exercise;
    const startAsymmetric = target.sides != null;

    const newLeftReps = target.sides ? target.sides.left.reps : leftReps;
    const newRightReps = target.sides ? target.sides.right.reps : rightReps;
    const newLeftLoad = target.sides ? cloneLoad(target.sides.left.load) : cloneLoad(leftLoad);
    const newRightLoad = target.sides ? cloneLoad(target.sides.right.load) : cloneLoad(rightLoad);
    const newLeftTempo = target.sides?.left.tempo;
    const newRightTempo = target.sides?.right.tempo;
    const newLoad = target.load ? cloneLoad(target.load) : cloneLoad(load);
    const newReps = target.reps ?? target.repRange.min;

    const newWarmupEnabled = exercise.warmupReps != null;
    const newWarmupReps =
      exercise.warmupReps ??
      (startAsymmetric && target.sides ? Math.min(target.sides.left.reps, target.sides.right.reps) : target.reps ?? target.repRange.min);
    const newWarmupLinked = warmupLoad == null;

    let newWarmupOverrideLeftLoad = warmupOverrideLeftLoad;
    let newWarmupOverrideRightLoad = warmupOverrideRightLoad;
    let newWarmupOverrideLoad = warmupOverrideLoad;
    if (startAsymmetric && target.sides) {
      const override = warmupLoad && "left" in warmupLoad ? warmupLoad : null;
      newWarmupOverrideLeftLoad = cloneLoad(override ? override.left : computeWarmupLoad(target.sides.left.load, equipment));
      newWarmupOverrideRightLoad = cloneLoad(override ? override.right : computeWarmupLoad(target.sides.right.load, equipment));
    } else {
      const override = warmupLoad && !("left" in warmupLoad) ? warmupLoad : null;
      newWarmupOverrideLoad = cloneLoad(override ?? computeWarmupLoad(target.load, equipment));
    }

    setAsymmetric(startAsymmetric);
    setLeftReps(newLeftReps);
    setRightReps(newRightReps);
    setLeftLoad(newLeftLoad);
    setRightLoad(newRightLoad);
    setLeftTempo(newLeftTempo);
    setRightTempo(newRightTempo);
    setLoad(newLoad);
    setReps(newReps);
    setWarmupEnabled(newWarmupEnabled);
    setWarmupReps(newWarmupReps);
    setWarmupLinked(newWarmupLinked);
    setWarmupOverrideLeftLoad(newWarmupOverrideLeftLoad);
    setWarmupOverrideRightLoad(newWarmupOverrideRightLoad);
    setWarmupOverrideLoad(newWarmupOverrideLoad);

    const snapshot: EditSnapshot = {
      asymmetric: startAsymmetric,
      reps: newReps,
      load: newLoad,
      leftReps: newLeftReps,
      rightReps: newRightReps,
      leftLoad: newLeftLoad,
      rightLoad: newRightLoad,
      warmupEnabled: newWarmupEnabled,
      warmupReps: newWarmupReps,
      warmupLinked: newWarmupLinked,
      warmupOverrideLoad: newWarmupOverrideLoad,
      warmupOverrideLeftLoad: newWarmupOverrideLeftLoad,
      warmupOverrideRightLoad: newWarmupOverrideRightLoad,
    };
    setInitialSnapshot(JSON.stringify(snapshot));
    setConfirmingDiscard(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingExerciseId]);

  if (!exercise) return null;

  const currentSnapshot: EditSnapshot = {
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
  };
  const isDirty = JSON.stringify(currentSnapshot) !== initialSnapshot;

  function requestClose() {
    if (isDirty) {
      setConfirmingDiscard(true);
    } else {
      closeEditMode();
    }
  }

  function handleAsymmetricToggle(checked: boolean) {
    if (checked) {
      if (exercise!.target.sides == null) {
        // First time splitting: start both sides from the current combined value.
        setLeftLoad(cloneLoad(load));
        setRightLoad(cloneLoad(load));
        setLeftReps(reps);
        setRightReps(reps);
      }
    } else {
      // Collapsing back to one combined value: the combined state (`load`/`reps`)
      // is never populated for an exercise that started asymmetric (the initial
      // effect only fills left/right), so carry the left side forward instead of
      // falling back to whatever `load` defaulted to.
      setLoad(cloneLoad(leftLoad));
      setReps(leftReps);
    }
    setAsymmetric(checked);
  }

  function handleSave() {
    if (!exercise) return;
    const date = todayISO();
    const entries: ProgressionEntry[] = [];
    let newTarget: ExerciseTarget;

    if (asymmetric) {
      const sides = {
        left: { load: leftLoad, reps: leftReps, tempo: leftTempo } as SideTarget,
        right: { load: rightLoad, reps: rightReps, tempo: rightTempo } as SideTarget,
      };
      newTarget = { ...exercise.target, reps: null, load: null, sides };
      entries.push({ date, load: leftLoad, reps: leftReps, note: null, side: "left" });
      entries.push({ date, load: rightLoad, reps: rightReps, note: null, side: "right" });
    } else {
      newTarget = { ...exercise.target, reps, load, sides: null };
      entries.push({ date, load, reps, note: null });
    }

    const newWarmupLoad: Exercise["warmupLoad"] = !warmupEnabled
      ? null
      : warmupLinked
        ? null
        : asymmetric
          ? { left: warmupOverrideLeftLoad, right: warmupOverrideRightLoad }
          : warmupOverrideLoad;

    // This checkbox is this sheet's own way to turn warmup off (or, from an
    // exercise with none, back on) — reps only means something when it's on.
    const newWarmupReps = warmupEnabled ? warmupReps : null;

    updateExerciseTarget(exercise.id, newTarget, entries, newWarmupLoad, newWarmupReps);
    closeEditMode();
  }

  const canSplitSides = exercise.target.perSide;

  if (confirmingDiscard) {
    return (
      <div className="sheet-backdrop" onClick={requestClose}>
        <div className="sheet" onClick={(e) => e.stopPropagation()}>
          <div className="discard-confirm">
            <div className="discard-confirm-text">Save Unsaved Changes?</div>
            <div className="discard-confirm-actions">
              <button type="button" className="confirm-discard-btn" onClick={closeEditMode}>
                Discard
              </button>
              <button type="button" className="confirm-save-btn" onClick={handleSave}>
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <GymModeContext.Provider value={editingExerciseIsGym}>
        <div className="sheet-backdrop" onClick={requestClose}>
        {/* Keyed by exercise id so every field (native range inputs especially) mounts fresh
            per exercise, instead of React patching a previous exercise's DOM nodes in place. */}
        <div key={editingExerciseId} className="sheet" onClick={(e) => e.stopPropagation()}>
          <div className="sheet-header">
            <h2>{exercise.name}</h2>
            <button type="button" className="sheet-close" onClick={requestClose} aria-label="Close">
              ×
            </button>
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
                      onChange={(e) => setWarmupLinked(e.target.checked)}
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
                          {formatLoadPreview(computeWarmupLoad(leftLoad, equipment))}
                        </div>
                      ) : (
                        <LoadEditor load={warmupOverrideLeftLoad} setLoad={setWarmupOverrideLeftLoad} />
                      )}
                    </div>
                    <div className="side-editor">
                      <div className="side-editor-label">Right</div>
                      {warmupLinked ? (
                        <div className="load-editor-preview">
                          {formatLoadPreview(computeWarmupLoad(rightLoad, equipment))}
                        </div>
                      ) : (
                        <LoadEditor load={warmupOverrideRightLoad} setLoad={setWarmupOverrideRightLoad} />
                      )}
                    </div>
                  </div>
                ) : warmupLinked ? (
                  <div className="load-editor-preview">{formatLoadPreview(computeWarmupLoad(load, equipment))}</div>
                ) : (
                  <LoadEditor load={warmupOverrideLoad} setLoad={setWarmupOverrideLoad} />
                )}
              </>
            )}
          </div>
  
          <div className="edit-mode-section">
            <div className="slider-label">Working</div>
  
            {canSplitSides && (
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={asymmetric}
                  onChange={(e) => handleAsymmetricToggle(e.target.checked)}
                />
                Left &amp; Right differ
              </label>
            )}
  
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
  
          <button type="button" className="save-btn" onClick={handleSave}>
            Save
          </button>
        </div>
        </div>
    </GymModeContext.Provider>
  );
}

interface SideEditorProps {
  label: string;
  reps: number;
  setReps: (n: number) => void;
  load: Load;
  setLoad: (l: Load) => void;
}

export function SideEditor({ label, reps, setReps, load, setLoad }: SideEditorProps) {
  return (
    <div className="side-editor">
      <div className="side-editor-label">{label}</div>
      <LoadEditor load={load} setLoad={setLoad} />
      <Stepper value={reps} unit="reps" min={1} step={REPS_STEP} onChange={setReps} />
    </div>
  );
}

export function LoadEditor({ load, setLoad }: { load: Load; setLoad: (l: Load) => void }) {
  const { equipment, addOwnedDumbbell, setLimitWeightToOwned } = useData();
  const isGym = useContext(GymModeContext);

  // Bodyweight and free weight share one stepper — bodyweight is just its zero
  // point, not a separate uneditable state. Stepping up from "Bodyweight" adds
  // real weight (freeWeight); stepping a light free weight down to 0 collapses
  // it back to bodyweight, rather than leaving a meaningless "0 lbs" load.
  if (load.kind === "bodyweight" || load.kind === "freeWeight") {
    const lbs = load.kind === "freeWeight" ? load.lbs : 0;
    const singleOwned = [...new Set([...equipment.ownedDumbbells, ...equipment.ownedKettlebells])];
    // A dumbbell entry is an owned *pair* — held one in each hand, or both
    // together for a heavier bilateral hold, so a pair of 15s reaches both 15
    // and 30, not just 15. Kettlebells are counted individually (not pairs),
    // but a matching pair of two owned kettlebells combines the same way.
    const ownedWeights = [...new Set([...singleOwned, ...singleOwned.map((w) => w * 2)])].sort((a, b) => a - b);
    const isOwned = lbs === 0 || ownedWeights.includes(lbs);
    // A gym has a full rack, so the restriction never applies there regardless
    // of the global "Limit to what I own" setting — that setting only means
    // something for a home workout.
    const restrictToOwned = equipment.limitWeightToOwned && !isGym;
    // "Limit to what I own" (Equipment Settings) swaps the fixed 0/3/5/+2.5
    // ladder for just your actual dumbbells/kettlebells (and their doubled
    // combinations) — falls back to the fixed ladder if nothing's owned yet,
    // since a stepper limited to only "Bodyweight" isn't a real choice, it's
    // just stuck.
    const sequence = restrictToOwned && ownedWeights.length > 0 ? [0, ...ownedWeights] : buildWeightSequence();
    return (
      <div className="load-editor">
        <Stepper
          value={lbs}
          unit="lbs"
          step={1}
          sequence={sequence}
          formatValue={(v) => (v === 0 ? "Bodyweight" : `${v} lbs`)}
          onChange={(v) => setLoad(v === 0 ? { kind: "bodyweight" } : { kind: "freeWeight", lbs: v })}
        />
        {/* Only fires in the unrestricted (fixed-ladder) mode — every value the
            owned-only sequence can reach is, by construction, already owned.
            Defaults to dumbbell (this app's exercises are overwhelmingly
            dumbbell-based) — reclassify as a kettlebell in Equipment Settings
            if that's what it actually was. */}
        {!isOwned && (
          <button type="button" className="equipment-add-hint" onClick={() => addOwnedDumbbell(lbs)}>
            + Add {lbs} lbs to your equipment
          </button>
        )}
        {!isGym && (
          <label className="toggle-row toggle-row-inline load-editor-restrict">
            <input
              type="checkbox"
              checked={equipment.limitWeightToOwned}
              onChange={(e) => setLimitWeightToOwned(e.target.checked)}
            />
            Restrict to home equipment
          </label>
        )}
      </div>
    );
  }

  if (load.kind === "loopBand") {
    const loopLoad = load;
    const loopStrengths = loopLoad.strengths as string[];
    const toggleStrength = (strength: string) => {
      const strengths = loopStrengths.includes(strength)
        ? loopStrengths.filter((s) => s !== strength)
        : [...loopStrengths, strength];
      setLoad({ kind: "loopBand", strengths: strengths as LoopBandLoad["strengths"] });
    };
    const label = loopLoad.strengths.map(capitalize).join(" + ");

    return (
      <div className="load-editor">
        <div className="band-picker">
          {LOOP_BAND_STRENGTHS.map((strength) => {
            const selected = loopStrengths.includes(strength);
            return (
              <button
                key={strength}
                type="button"
                className={`band-swatch${selected ? " selected" : ""}`}
                style={{ backgroundColor: LOOP_BAND_HEX[strength] }}
                onClick={() => toggleStrength(strength)}
                aria-pressed={selected}
                aria-label={`${strength} loop band`}
                title={capitalize(strength)}
              />
            );
          })}
          <div className="band-weight">{label || "—"}</div>
        </div>
      </div>
    );
  }

  const bandLoad = load as BandLoad;
  const toggleBand = (color: string) => {
    const bands = bandLoad.bands.includes(color)
      ? bandLoad.bands.filter((b) => b !== color)
      : [...bandLoad.bands, color];
    setLoad({ ...bandLoad, bands });
  };
  const weight = computeBandWeight(bandLoad.bands);

  return (
    <div className="load-editor">
      <div className="band-picker">
        {BAND_COLORS.map((color) => {
          const selected = bandLoad.bands.includes(color);
          return (
            <button
              key={color}
              type="button"
              className={`band-swatch${selected ? " selected" : ""}`}
              style={{ backgroundColor: BAND_HEX[color] }}
              onClick={() => toggleBand(color)}
              aria-pressed={selected}
              aria-label={`${color} band, ${BAND_WEIGHTS[color]} lbs`}
              title={`${color} — ${BAND_WEIGHTS[color]} lbs`}
            />
          );
        })}
        <div className="band-weight">{weight > 0 ? `${weight} lbs` : "—"}</div>
      </div>
    </div>
  );
}
