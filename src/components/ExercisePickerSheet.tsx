import { useState } from "react";
import { LoadEditor, REPS_STEP, Stepper } from "./EditModeSheet";
import { searchExercises } from "../lib/exerciseSearch";
import { useData } from "../lib/DataContext";
import type { ExerciseTarget, Load } from "../types";

const LOAD_KINDS: { kind: Load["kind"]; label: string }[] = [
  { kind: "freeWeight", label: "Free Weight" },
  { kind: "band", label: "Band" },
  { kind: "loopBand", label: "Loop Band" },
  { kind: "bodyweight", label: "Bodyweight" },
];

function defaultLoadForKind(kind: Load["kind"]): Load {
  switch (kind) {
    case "freeWeight":
      return { kind: "freeWeight", lbs: 5 };
    case "band":
      return { kind: "band", bands: [] };
    case "loopBand":
      return { kind: "loopBand", strengths: [] };
    case "bodyweight":
      return { kind: "bodyweight" };
  }
}

/** New exercises need to pick a load *kind* up front — existing exercises never do this
 * through the UI (EditModeSheet's LoadEditor only ever edits the *value* of a kind that's
 * already fixed by the data), so this picker only exists here. */
function LoadKindPicker({ load, setLoad }: { load: Load; setLoad: (l: Load) => void }) {
  return (
    <div className="kind-picker">
      {LOAD_KINDS.map(({ kind, label }) => (
        <button
          key={kind}
          type="button"
          className={`kind-picker-btn${load.kind === kind ? " selected" : ""}`}
          onClick={() => setLoad(defaultLoadForKind(kind))}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

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
 * existing library by name or tag, or fall through to "+ New Exercise" to define one
 * that doesn't exist yet — same sheet, toggled content, matching how Notes toggles
 * between its add/edit views rather than stacking a second sheet. */
export default function ExercisePickerSheet({ onClose, onSelect, excludeExerciseIds }: ExercisePickerSheetProps) {
  const { exercises } = useData();
  const [mode, setMode] = useState<Mode>("browse");
  const [query, setQuery] = useState("");

  const results = searchExercises(exercises, query);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <h2>{mode === "browse" ? "Add Exercise" : "New Exercise"}</h2>
          <button type="button" className="sheet-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {mode === "browse" ? (
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
                      <div className="picker-item-tags">Already in this superset</div>
                    ) : (
                      exercise.tags.length > 0 && <div className="picker-item-tags">{exercise.tags.join(", ")}</div>
                    )}
                  </button>
                );
              })}
              {results.length === 0 && <div className="empty-state">No exercises match "{query}".</div>}
            </div>
            <button type="button" className="add-note-trigger picker-new-trigger" onClick={() => setMode("create")}>
              + New Exercise
            </button>
          </>
        ) : (
          <NewExerciseForm
            onBack={() => setMode("browse")}
            onCreate={(id) => {
              onSelect(id);
              onClose();
            }}
          />
        )}
      </div>
    </div>
  );
}

interface NewExerciseFormProps {
  onBack: () => void;
  onCreate: (exerciseId: string) => void;
}

function NewExerciseForm({ onBack, onCreate }: NewExerciseFormProps) {
  const { createExercise } = useData();
  const [name, setName] = useState("");
  const [asymmetric, setAsymmetric] = useState(false);
  const [reps, setReps] = useState(10);
  const [load, setLoad] = useState<Load>({ kind: "bodyweight" });
  const [leftReps, setLeftReps] = useState(10);
  const [rightReps, setRightReps] = useState(10);
  const [leftLoad, setLeftLoad] = useState<Load>({ kind: "bodyweight" });
  const [rightLoad, setRightLoad] = useState<Load>({ kind: "bodyweight" });
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");

  const canCreate = name.trim().length > 0;

  function addTag() {
    const trimmed = newTag.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    setTags([...tags, trimmed]);
    setNewTag("");
  }

  function removeTag(index: number) {
    setTags(tags.filter((_, i) => i !== index));
  }

  function handleCreate() {
    if (!canCreate) return;

    const target: ExerciseTarget = asymmetric
      ? {
          repRange: { min: Math.min(leftReps, rightReps), max: Math.max(leftReps, rightReps) },
          perSide: true,
          reps: null,
          load: null,
          sides: { left: { load: leftLoad, reps: leftReps }, right: { load: rightLoad, reps: rightReps } },
        }
      : {
          repRange: { min: reps, max: reps },
          perSide: false,
          reps,
          load,
          sides: null,
        };

    const id = createExercise({ name: name.trim(), target, tags });
    onCreate(id);
  }

  return (
    <>
      <div className="detail-field">
        <div className="slider-label">Name</div>
        <input
          type="text"
          className="detail-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Standing Calf Raises"
          autoFocus
        />
      </div>

      <label className="toggle-row">
        <input type="checkbox" checked={asymmetric} onChange={(e) => setAsymmetric(e.target.checked)} />
        Left &amp; Right differ
      </label>

      {asymmetric ? (
        <div className="sides-editor">
          <div className="side-editor">
            <div className="side-editor-label">Left</div>
            <LoadKindPicker load={leftLoad} setLoad={setLeftLoad} />
            <LoadEditor load={leftLoad} setLoad={setLeftLoad} />
            <Stepper value={leftReps} unit="reps" min={1} step={REPS_STEP} onChange={setLeftReps} />
          </div>
          <div className="side-editor">
            <div className="side-editor-label">Right</div>
            <LoadKindPicker load={rightLoad} setLoad={setRightLoad} />
            <LoadEditor load={rightLoad} setLoad={setRightLoad} />
            <Stepper value={rightReps} unit="reps" min={1} step={REPS_STEP} onChange={setRightReps} />
          </div>
        </div>
      ) : (
        <>
          <LoadKindPicker load={load} setLoad={setLoad} />
          <LoadEditor load={load} setLoad={setLoad} />
          <Stepper value={reps} unit="reps" min={1} step={REPS_STEP} onChange={setReps} />
        </>
      )}

      <div className="detail-field">
        <div className="slider-label">Tags</div>
        {tags.map((tag, i) => (
          <div key={i} className="cue-row">
            <div className="cue-text">{tag}</div>
            <button type="button" className="cue-remove" onClick={() => removeTag(i)} aria-label={`Remove tag: ${tag}`}>
              ×
            </button>
          </div>
        ))}
        <div className="cue-add-row">
          <input
            type="text"
            className="detail-input"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="e.g. legs, core"
          />
          <button type="button" className="cue-add-btn" onClick={addTag}>
            Add
          </button>
        </div>
      </div>

      <div className="note-add-actions">
        <button type="button" className="note-add-cancel" onClick={onBack}>
          Back
        </button>
        <button type="button" className="save-btn picker-create-btn" onClick={handleCreate} disabled={!canCreate}>
          Create
        </button>
      </div>
    </>
  );
}
