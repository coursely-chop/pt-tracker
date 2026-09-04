import { useRef, useState, type ChangeEvent } from "react";
import { Stepper, buildWeightSequence } from "../components/EditModeSheet";
import { BAND_COLORS, BAND_HEX, BAND_WEIGHTS, LOOP_BAND_HEX, LOOP_BAND_STRENGTHS } from "../lib/equipment";
import { capitalize, todayISO } from "../lib/format";
import { useData } from "../lib/DataContext";
import { exportDataAsJson, restoreDataFromJson } from "../lib/storage";

interface WeightListProps {
  label: string;
  singularLabel: string;
  hint: string;
  emptyText: string;
  weights: number[];
  onAdd: (lbs: number) => void;
  onRemove: (lbs: number) => void;
}

/** Shared list UI for both Dumbbells and Kettlebells — same add/remove
 * mechanics either way, just different copy and which owned list they touch
 * (the pair-vs-single assumption lives in the hint text, not the component).
 * Adding is a reveal, not an always-visible text field: a plain number input
 * looked and felt out of place next to everything else here being tap
 * controls, so "+ Add" instead reveals the same large stepper used for
 * dialing in a value, with Cancel/Add to commit or back out. */
function WeightList({ label, singularLabel, hint, emptyText, weights, onAdd, onRemove }: WeightListProps) {
  const [adding, setAdding] = useState(false);
  const [newWeight, setNewWeight] = useState(5);

  function startAdding() {
    setNewWeight(5);
    setAdding(true);
  }

  function handleAdd() {
    onAdd(newWeight);
    setAdding(false);
  }

  return (
    <div className="detail-section">
      <div className="detail-section-label">{label}</div>
      <div className="detail-hint">{hint}</div>
      {weights.length === 0 && !adding && <div className="hint-box equipment-empty">{emptyText}</div>}
      {weights.map((lbs) => (
        <div key={lbs} className="cue-row">
          <div className="cue-text">{lbs} lbs</div>
          <button type="button" className="cue-remove" onClick={() => onRemove(lbs)} aria-label={`Remove ${lbs} lbs`}>
            ×
          </button>
        </div>
      ))}

      {adding ? (
        <div className="equipment-add-control">
          <Stepper large value={newWeight} unit="lbs" step={1} sequence={buildWeightSequence(false)} onChange={setNewWeight} />
          <div className="equipment-add-actions">
            <button type="button" className="equipment-add-cancel" onClick={() => setAdding(false)}>
              Cancel
            </button>
            <button type="button" className="equipment-add-confirm" onClick={handleAdd}>
              Add
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="add-note-trigger" onClick={startAdding}>
          + Add {singularLabel}
        </button>
      )}
    </div>
  );
}

/** Manual backup/restore — the only protection against data loss for a
 * localStorage-only app with no backend. Restoring reloads the page rather
 * than threading the new data through every context setter, since it's a
 * rare, all-or-nothing action anyway. */
function BackupRestore() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  function handleExport() {
    const json = exportDataAsJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pt-tracker-backup-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handleFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        restoreDataFromJson(reader.result as string);
        setRestored(true);
        window.location.reload();
      } catch {
        setError("That doesn't look like a PT Tracker backup file.");
      }
    };
    reader.onerror = () => setError("Couldn't read that file.");
    reader.readAsText(file);
  }

  return (
    <div className="detail-section">
      <div className="detail-section-label">Backup & Restore</div>
      <div className="detail-hint">
        This app only saves data on this device. Download a backup occasionally so a lost or reset phone doesn't
        mean lost workout history.
      </div>
      <div className="equipment-add-actions">
        <button type="button" className="equipment-add-cancel" onClick={handleExport}>
          Download Backup
        </button>
        <button type="button" className="equipment-add-confirm" onClick={() => fileInputRef.current?.click()}>
          Restore from Backup
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        onChange={handleFileSelected}
        style={{ display: "none" }}
      />
      {error && <p className="hint-box equipment-empty">{error}</p>}
      {restored && <p className="hint-box equipment-empty">Restored — reloading...</p>}
    </div>
  );
}

/** What's actually in the closet — feeds the computed warmup suggestion
 * (Movement Detail's Warmup section) rather than restricting what you can
 * set as a working target, which stays free-form on purpose. Rarely edited:
 * once when this screen first exists, then only when equipment changes —
 * see the "+ Add ... to your equipment" prompt in Edit Mode for the more
 * common way a new dumbbell weight actually gets added here.
 *
 * No screen chrome of its own (back link, title) — it's embedded as a
 * section of the Settings screen rather than reached as its own route. */
export default function EquipmentSection() {
  const {
    equipment,
    addOwnedDumbbell,
    removeOwnedDumbbell,
    addOwnedKettlebell,
    removeOwnedKettlebell,
    toggleOwnedBand,
    toggleOwnedLoopBand,
    setLimitWeightToOwned,
  } = useData();

  return (
    <>
      <p className="hint-box screen-intro">Add your home equipment to enable warmup suggestion for home workouts.</p>

      <label className="toggle-row">
        <input
          type="checkbox"
          checked={equipment.limitWeightToOwned}
          onChange={(e) => setLimitWeightToOwned(e.target.checked)}
        />
        Limit the weight stepper to equipment I own
      </label>

      <WeightList
        label="Dumbbells"
        singularLabel="Dumbbell"
        hint={'Assumed to come in pairs — enter the weight of one (e.g. a 10 lb pair is just "10"), not the total.'}
        emptyText="No dumbbells added yet."
        weights={equipment.ownedDumbbells}
        onAdd={addOwnedDumbbell}
        onRemove={removeOwnedDumbbell}
      />

      <WeightList
        label="Kettlebells"
        singularLabel="Kettlebell"
        hint="Counted individually, not assumed to be pairs like dumbbells."
        emptyText="No kettlebells added yet."
        weights={equipment.ownedKettlebells}
        onAdd={addOwnedKettlebell}
        onRemove={removeOwnedKettlebell}
      />

      <div className="detail-section">
        <div className="detail-section-label">Tube Bands</div>
        <div className="detail-hint">Tap to mark which resistance bands you actually own.</div>
        <div className="band-picker">
          {BAND_COLORS.map((color) => {
            const owned = equipment.ownedBands.includes(color);
            return (
              <button
                key={color}
                type="button"
                className={`band-swatch${owned ? " selected" : ""}`}
                style={{ backgroundColor: BAND_HEX[color] }}
                onClick={() => toggleOwnedBand(color)}
                aria-pressed={owned}
                aria-label={`${color} band, ${BAND_WEIGHTS[color]} lbs${owned ? ", owned" : ""}`}
                title={`${color} — ${BAND_WEIGHTS[color]} lbs`}
              />
            );
          })}
        </div>
      </div>

      <div className="detail-section">
        <div className="detail-section-label">Loop Bands</div>
        <div className="detail-hint">
          Closed-loop bands, worn one at a time (e.g. for lateral band walks) — a separate set from the tube bands
          above, even where a color name repeats.
        </div>
        <div className="band-picker">
          {LOOP_BAND_STRENGTHS.map((strength) => {
            const owned = equipment.ownedLoopBands.includes(strength);
            return (
              <button
                key={strength}
                type="button"
                className={`band-swatch${owned ? " selected" : ""}`}
                style={{ backgroundColor: LOOP_BAND_HEX[strength] }}
                onClick={() => toggleOwnedLoopBand(strength)}
                aria-pressed={owned}
                aria-label={`${strength} loop band${owned ? ", owned" : ""}`}
                title={capitalize(strength)}
              />
            );
          })}
        </div>
      </div>

      <BackupRestore />
    </>
  );
}
