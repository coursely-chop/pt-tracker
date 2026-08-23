import { useEffect, useState } from "react";
import { formatLoad, todayISO } from "../lib/format";
import { useData } from "../lib/DataContext";
import type { BandLoad, ExerciseTarget, Load, ProgressionEntry, RepsTarget, SideTarget } from "../types";

const WEIGHT_STEP = 2.5;
const REPS_STEP = 1;
const BAND_COLORS = ["yellow", "green", "blue", "black", "red"];

function cloneLoad(load: Load): Load {
  return JSON.parse(JSON.stringify(load));
}

function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

interface StepperProps {
  label?: string;
  value: number;
  unit: string;
  step: number;
  min?: number;
  onChange: (value: number) => void;
}

/** Gains here are incremental by design (2.5/5/7.5/10 lb jumps, 1 rep at a time) —
 * every tap moves exactly one step, so there's no drag-to-an-arbitrary-position
 * control to get wrong. The value stays centered; − and + sit at each end. */
function Stepper({ label, value, unit, step, min = 0, onChange }: StepperProps) {
  const decrement = () => onChange(Math.max(min, roundToStep(value - step, step)));
  const increment = () => onChange(roundToStep(value + step, step));

  return (
    <div className="stepper-field">
      {label && <div className="slider-label">{label}</div>}
      <div className="stepper-row">
        <button
          type="button"
          className="stepper-btn"
          onClick={decrement}
          disabled={value <= min}
          aria-label={`Decrease ${label ?? unit}`}
        >
          −
        </button>
        <div className="stepper-value">
          {value} {unit}
        </div>
        <button type="button" className="stepper-btn" onClick={increment} aria-label={`Increase ${label ?? unit}`}>
          +
        </button>
      </div>
    </div>
  );
}

export default function EditModeSheet() {
  const { editingExerciseId, closeEditMode, getExercise, updateExerciseTarget } = useData();
  const exercise = editingExerciseId ? getExercise(editingExerciseId) : undefined;

  const [asymmetric, setAsymmetric] = useState(false);
  const [useRange, setUseRange] = useState(false);
  const [reps, setReps] = useState(1);
  const [repsMax, setRepsMax] = useState(1);
  const [load, setLoad] = useState<Load>({ kind: "bodyweight" });
  const [leftReps, setLeftReps] = useState(1);
  const [rightReps, setRightReps] = useState(1);
  const [leftLoad, setLeftLoad] = useState<Load>({ kind: "bodyweight" });
  const [rightLoad, setRightLoad] = useState<Load>({ kind: "bodyweight" });
  const [leftTempo, setLeftTempo] = useState<string | undefined>();
  const [rightTempo, setRightTempo] = useState<string | undefined>();

  // Re-initialize form state only when a (possibly different) exercise is opened,
  // not on every subsequent data write elsewhere in the app.
  useEffect(() => {
    if (!exercise) return;
    const { target } = exercise;
    const startAsymmetric = target.sides != null;
    setAsymmetric(startAsymmetric);

    if (startAsymmetric && target.sides) {
      setLeftReps(target.sides.left.reps);
      setRightReps(target.sides.right.reps);
      setLeftLoad(cloneLoad(target.sides.left.load));
      setRightLoad(cloneLoad(target.sides.right.load));
      setLeftTempo(target.sides.left.tempo);
      setRightTempo(target.sides.right.tempo);
    } else if (target.load) {
      setLoad(cloneLoad(target.load));
    }

    if (target.reps != null && typeof target.reps === "object") {
      setUseRange(true);
      setReps(target.reps.min);
      setRepsMax(target.reps.max);
    } else {
      const fallback = typeof target.reps === "number" ? target.reps : target.repRange.min;
      setUseRange(false);
      setReps(fallback);
      setRepsMax(fallback);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingExerciseId]);

  if (!exercise) return null;

  function handleAsymmetricToggle(checked: boolean) {
    if (checked && exercise!.target.sides == null) {
      // First time splitting: start both sides from the current combined value.
      setLeftLoad(cloneLoad(load));
      setRightLoad(cloneLoad(load));
      setLeftReps(reps);
      setRightReps(reps);
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
      const repsValue: RepsTarget = useRange ? { min: reps, max: repsMax } : reps;
      newTarget = { ...exercise.target, reps: repsValue, load, sides: null };
      entries.push({ date, load, reps: repsValue, note: null });
    }

    updateExerciseTarget(exercise.id, newTarget, entries);
    closeEditMode();
  }

  const canSplitSides = exercise.target.perSide;

  return (
    <div className="sheet-backdrop" onClick={closeEditMode}>
      {/* Keyed by exercise id so every field (native range inputs especially) mounts fresh
          per exercise, instead of React patching a previous exercise's DOM nodes in place. */}
      <div key={editingExerciseId} className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <h2>{exercise.name}</h2>
          <button type="button" className="sheet-close" onClick={closeEditMode} aria-label="Close">
            ×
          </button>
        </div>

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
            <div className="field-group">
              <label className="toggle-row">
                <input type="checkbox" checked={useRange} onChange={(e) => setUseRange(e.target.checked)} />
                Use a rep range
              </label>
              {useRange ? (
                <>
                  <Stepper
                    label="Min"
                    value={reps}
                    unit="reps"
                    min={1}
                    step={REPS_STEP}
                    onChange={(v) => setReps(Math.min(v, repsMax))}
                  />
                  <Stepper
                    label="Max"
                    value={repsMax}
                    unit="reps"
                    min={reps}
                    step={REPS_STEP}
                    onChange={(v) => setRepsMax(Math.max(v, reps))}
                  />
                </>
              ) : (
                <Stepper value={reps} unit="reps" min={1} step={REPS_STEP} onChange={setReps} />
              )}
            </div>
          </>
        )}

        <button type="button" className="save-btn" onClick={handleSave}>
          Save
        </button>
      </div>
    </div>
  );
}

interface SideEditorProps {
  label: string;
  reps: number;
  setReps: (n: number) => void;
  load: Load;
  setLoad: (l: Load) => void;
}

function SideEditor({ label, reps, setReps, load, setLoad }: SideEditorProps) {
  return (
    <div className="side-editor">
      <div className="side-editor-label">{label}</div>
      <LoadEditor load={load} setLoad={setLoad} />
      <Stepper value={reps} unit="reps" min={1} step={REPS_STEP} onChange={setReps} />
    </div>
  );
}

function LoadEditor({ load, setLoad }: { load: Load; setLoad: (l: Load) => void }) {
  if (load.kind === "bodyweight") {
    return <div className="load-editor bodyweight-note">Bodyweight — no weight to adjust</div>;
  }

  if (load.kind === "freeWeight") {
    return (
      <div className="load-editor">
        <Stepper value={load.lbs} unit="lbs" min={0} step={WEIGHT_STEP} onChange={(v) => setLoad({ kind: "freeWeight", lbs: v })} />
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

  return (
    <div className="load-editor">
      <div className="band-picker">
        {BAND_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={`band-chip${bandLoad.bands.includes(color) ? " selected" : ""}`}
            onClick={() => toggleBand(color)}
          >
            {color}
          </button>
        ))}
      </div>
      {bandLoad.equivalentLbs != null ? (
        <>
          <Stepper
            label="Equivalent weight"
            value={bandLoad.equivalentLbs}
            unit="lbs"
            min={0}
            step={WEIGHT_STEP}
            onChange={(v) => setLoad({ ...bandLoad, equivalentLbs: v })}
          />
          <button
            type="button"
            className="text-link-btn"
            onClick={() => setLoad({ ...bandLoad, equivalentLbs: undefined })}
          >
            Clear equivalent weight
          </button>
        </>
      ) : (
        <button type="button" className="text-link-btn" onClick={() => setLoad({ ...bandLoad, equivalentLbs: 10 })}>
          + Set equivalent weight
        </button>
      )}
      <div className="load-preview">{formatLoad(bandLoad)}</div>
    </div>
  );
}
