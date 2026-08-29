import { useEffect, useState } from "react";
import { capitalize, computeWarmupLoad, todayISO } from "../lib/format";
import { BAND_COLORS, BAND_HEX, BAND_WEIGHTS, LOOP_BAND_HEX, LOOP_BAND_STRENGTHS, computeBandWeight } from "../lib/equipment";
import { useData } from "../lib/DataContext";
import type { BandLoad, Exercise, ExerciseTarget, Load, LoopBandLoad, ProgressionEntry, SideTarget } from "../types";

/** Read-only text for the "Match Working" preview — no band dots needed here,
 * unlike the glanceable views (Workout Overview, Movement Detail); a plain
 * label is enough for a value you can't currently touch. */
function formatLoadPreview(load: Load): string {
  if (load.kind === "bodyweight") return "Bodyweight";
  if (load.kind === "freeWeight") return `${load.lbs} lbs`;
  if (load.kind === "loopBand") return load.strengths.map(capitalize).join(" & ") || "—";
  const weight = computeBandWeight(load.bands);
  const label = load.bands.map(capitalize).join(" & ");
  return weight > 0 ? `${label} (${weight} lbs)` : label || "—";
}

export const WEIGHT_STEP = 2.5;
export const REPS_STEP = 1;

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
  /** Overrides the default "{value} {unit}" display — e.g. showing "Bodyweight"
   * at 0 instead of "0 lbs" — without teaching Stepper itself about load kinds. */
  formatValue?: (value: number) => string;
  /** Bigger buttons for a standalone, deliberate action (e.g. Equipment's "add
   * a new weight" flow) — the default size is tuned for a sheet already dense
   * with controls, where this one is the only thing on the screen. */
  large?: boolean;
}

/** Gains here are incremental by design (2.5/5/7.5/10 lb jumps, 1 rep at a time) —
 * every tap moves exactly one step, so there's no drag-to-an-arbitrary-position
 * control to get wrong. The value stays centered; − and + sit at each end. */
export function Stepper({ label, value, unit, step, min = 0, onChange, formatValue, large }: StepperProps) {
  const decrement = () => onChange(Math.max(min, roundToStep(value - step, step)));
  const increment = () => onChange(roundToStep(value + step, step));

  return (
    <div className="stepper-field">
      {label && <div className="slider-label">{label}</div>}
      <div className={`stepper-row${large ? " stepper-row-lg" : ""}`}>
        <button
          type="button"
          className={`stepper-btn${large ? " stepper-btn-lg" : ""}`}
          onClick={decrement}
          disabled={value <= min}
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

export default function EditModeSheet() {
  const { editingExerciseId, closeEditMode, getExercise, updateExerciseTarget, equipment } = useData();
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

  // Re-initialize form state only when a (possibly different) exercise is opened,
  // not on every subsequent data write elsewhere in the app.
  useEffect(() => {
    if (!exercise) return;
    const { target, warmupLoad } = exercise;
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
    setReps(target.reps ?? target.repRange.min);

    setWarmupLinked(warmupLoad == null);
    if (startAsymmetric && target.sides) {
      const override = warmupLoad && "left" in warmupLoad ? warmupLoad : null;
      setWarmupOverrideLeftLoad(
        cloneLoad(override ? override.left : computeWarmupLoad(target.sides.left.load, equipment))
      );
      setWarmupOverrideRightLoad(
        cloneLoad(override ? override.right : computeWarmupLoad(target.sides.right.load, equipment))
      );
    } else {
      const override = warmupLoad && !("left" in warmupLoad) ? warmupLoad : null;
      setWarmupOverrideLoad(cloneLoad(override ?? computeWarmupLoad(target.load, equipment)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingExerciseId]);

  if (!exercise) return null;

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

    const newWarmupLoad: Exercise["warmupLoad"] = warmupLinked
      ? null
      : asymmetric
        ? { left: warmupOverrideLeftLoad, right: warmupOverrideRightLoad }
        : warmupOverrideLoad;

    updateExerciseTarget(exercise.id, newTarget, entries, newWarmupLoad);
    closeEditMode();
  }

  const canSplitSides = exercise.target.perSide;
  const hasWarmup = exercise.warmupReps != null;

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

        {hasWarmup && (
          <div className="edit-mode-section">
            <div className="edit-mode-section-header">
              <div className="slider-label">Warmup ({exercise.warmupReps} reps)</div>
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
          </div>
        )}

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
  const { equipment, addOwnedDumbbell } = useData();

  // Bodyweight and free weight share one stepper — bodyweight is just its zero
  // point, not a separate uneditable state. Stepping up from "Bodyweight" adds
  // real weight (freeWeight); stepping a light free weight down to 0 collapses
  // it back to bodyweight, rather than leaving a meaningless "0 lbs" load.
  if (load.kind === "bodyweight" || load.kind === "freeWeight") {
    const lbs = load.kind === "freeWeight" ? load.lbs : 0;
    const isOwned = lbs === 0 || equipment.ownedDumbbells.includes(lbs) || equipment.ownedKettlebells.includes(lbs);
    return (
      <div className="load-editor">
        <Stepper
          value={lbs}
          unit="lbs"
          min={0}
          step={WEIGHT_STEP}
          formatValue={(v) => (v === 0 ? "Bodyweight" : `${v} lbs`)}
          onChange={(v) => setLoad(v === 0 ? { kind: "bodyweight" } : { kind: "freeWeight", lbs: v })}
        />
        {/* Working weight is deliberately free-form — it isn't restricted to owned
            equipment — but if you dial in something new, this is the moment to
            capture it, rather than a separate trip to Equipment settings later.
            Defaults to dumbbell (this app's exercises are overwhelmingly
            dumbbell-based) — reclassify as a kettlebell in Equipment Settings
            if that's what it actually was. */}
        {!isOwned && (
          <button type="button" className="equipment-add-hint" onClick={() => addOwnedDumbbell(lbs)}>
            + Add {lbs} lbs to your equipment
          </button>
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
