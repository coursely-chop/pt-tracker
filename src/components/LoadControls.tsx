import { createContext, useContext } from "react";
import { capitalize } from "../lib/format";
import { LOOP_BAND_HEX, LOOP_BAND_STRENGTHS } from "../lib/equipment";
import { useData } from "../lib/DataContext";
import type { Load, LoopBandLoad } from "../types";

/** Read-only text for the "Match Working" preview — no band dots needed here,
 * unlike the glanceable views (Workout Overview, Movement Detail); a plain
 * label is enough for a value you can't currently touch. */
export function formatLoadPreview(load: Load): string {
  if (load.kind === "bodyweight") return "Bodyweight";
  if (load.kind === "loopBand") return load.strengths.map(capitalize).join(" & ") || "—";
  return `${load.lbs} lbs`;
}

export const LOAD_KINDS: { kind: Load["kind"]; label: string }[] = [
  { kind: "freeWeight", label: "Free Weight" },
  { kind: "machine", label: "Machine" },
  { kind: "band", label: "Band" },
  { kind: "loopBand", label: "Loop Band" },
  { kind: "bodyweight", label: "Bodyweight" },
];

/** Switches to a new load kind, preserving whatever of the current value
 * still means something under the new kind (free weight <-> machine share a
 * plain lbs number — no reason to make you re-enter 170 just to fix a
 * mistaken "Free Weight" into "Machine") rather than always resetting to a
 * fixed default. Nothing else carries over: a band's colors don't mean
 * anything as a machine's increment. */
export function convertLoad(current: Load, kind: Load["kind"]): Load {
  const lbs = "lbs" in current ? current.lbs : 5;
  switch (kind) {
    case "freeWeight":
      return { kind: "freeWeight", lbs };
    case "machine":
      return { kind: "machine", lbs, increment: current.kind === "machine" ? current.increment : 10 };
    case "band":
      return { kind: "band", lbs: "lbs" in current ? Math.max(BAND_STEP, roundToStep(current.lbs, BAND_STEP)) : 20 };
    case "loopBand":
      return { kind: "loopBand", strengths: current.kind === "loopBand" ? current.strengths : [] };
    case "bodyweight":
      return { kind: "bodyweight" };
  }
}

/** Lets a load's *kind* itself be changed, not just its value — originally
 * creation-only (existing exercises couldn't change kind at all, only edit
 * the value of one already fixed by the data), until real use surfaced a
 * real gap: an exercise created as the wrong kind (e.g. a machine
 * mis-created as Free Weight) had no way to fix that short of deleting and
 * recreating it. Shown everywhere a Load is edited now, working or warmup —
 * rarely used after an exercise's first save, but no real cost to always
 * showing it, and hiding it behind some other affordance would just be
 * something else to remember exists. */
export function LoadKindPicker({
  selectedKind,
  onSelect,
}: {
  selectedKind: Load["kind"];
  onSelect: (kind: Load["kind"]) => void;
}) {
  return (
    <select
      className="detail-input kind-select"
      value={selectedKind}
      onChange={(e) => onSelect(e.target.value as Load["kind"])}
      aria-label="Resistance type"
    >
      {LOAD_KINDS.map(({ kind, label }) => (
        <option key={kind} value={kind}>
          {label}
        </option>
      ))}
    </select>
  );
}

export const REPS_STEP = 1;

/** True while editing an exercise reached from a gym workout — set by
 * WorkoutBuilder (creating/adding exercises) and ExerciseSheet itself
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

/** A machine's own stepper sequence — just its increment, repeated, since a
 * weight stack doesn't have free weights' light-end irregularity (no
 * "3 lb rehab weight" equivalent to special-case). Capped well past any real
 * stack. */
function buildMachineSequence(increment: number): number[] {
  const sequence: number[] = [];
  for (let w = 0; w <= 500; w += increment) sequence.push(w);
  return sequence;
}

/** Tube bands step in tens — the resistance of the bands that exist, not an
 * arbitrary increment. Capped well past anything wearable. */
const BAND_STEP = 10;
const BAND_SEQUENCE = Array.from({ length: 50 }, (_, i) => (i + 1) * BAND_STEP);

export function cloneLoad(load: Load): Load {
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

  if (load.kind === "machine") {
    const machineLoad = load;
    const sequence = buildMachineSequence(machineLoad.increment);
    return (
      <div className="load-editor">
        <Stepper
          value={machineLoad.lbs}
          unit="lbs"
          step={1}
          sequence={sequence}
          onChange={(v) => setLoad({ ...machineLoad, lbs: v })}
        />
        {/* Every machine has its own plate/stack increment — not owned
            equipment, not app-wide, so it's stored per-load and set right
            here rather than in Equipment Settings. Changing it re-snaps the
            current weight so it always lands on a real rung. */}
        <Stepper
          label="Increment"
          value={machineLoad.increment}
          unit="lbs"
          step={2.5}
          min={2.5}
          onChange={(increment) =>
            setLoad({ ...machineLoad, increment, lbs: roundToStep(machineLoad.lbs, increment) })
          }
        />
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

  // Tube bands: resistance only, in 10 lb steps. The sequence (rather than
  // plain ±10 arithmetic) means an older off-grid value like 65 just snaps to
  // the nearest step on the first tap instead of being stranded between them.
  return (
    <div className="load-editor">
      <Stepper value={load.lbs} unit="lbs" step={BAND_STEP} sequence={BAND_SEQUENCE} onChange={(lbs) => setLoad({ kind: "band", lbs })} />
    </div>
  );
}
