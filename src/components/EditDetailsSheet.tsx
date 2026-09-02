import { useEffect, useState } from "react";
import { Stepper } from "./EditModeSheet";
import { useData } from "../lib/DataContext";

interface Snapshot {
  hasWarmup: boolean;
  warmupReps: number;
  progressionRule: string;
  cues: string[];
  newCue: string;
  tags: string[];
  newTag: string;
  instructionalLink: string;
  videoLink: string;
}

export default function EditDetailsSheet() {
  const { editingDetailsExerciseId, closeEditDetails, getExercise, updateExerciseDetails } = useData();
  const exercise = editingDetailsExerciseId ? getExercise(editingDetailsExerciseId) : undefined;

  const [hasWarmup, setHasWarmup] = useState(false);
  const [warmupReps, setWarmupReps] = useState(1);
  const [progressionRule, setProgressionRule] = useState("");
  const [cues, setCues] = useState<string[]>([]);
  const [newCue, setNewCue] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [instructionalLink, setInstructionalLink] = useState("");
  const [videoLink, setVideoLink] = useState("");
  const [initialSnapshot, setInitialSnapshot] = useState("");
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  // Re-initialize only when a (possibly different) exercise is opened.
  useEffect(() => {
    if (!exercise) return;
    const snapshot: Snapshot = {
      hasWarmup: exercise.warmupReps != null,
      warmupReps: exercise.warmupReps ?? 1,
      progressionRule: exercise.progressionRule ?? "",
      cues: exercise.cues,
      newCue: "",
      tags: exercise.tags,
      newTag: "",
      instructionalLink: exercise.links.instructional ?? "",
      videoLink: exercise.links.video ?? "",
    };
    setHasWarmup(snapshot.hasWarmup);
    setWarmupReps(snapshot.warmupReps);
    setProgressionRule(snapshot.progressionRule);
    setCues(snapshot.cues);
    setNewCue("");
    setTags(snapshot.tags);
    setNewTag("");
    setInstructionalLink(snapshot.instructionalLink);
    setVideoLink(snapshot.videoLink);
    setInitialSnapshot(JSON.stringify(snapshot));
    setConfirmingDiscard(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingDetailsExerciseId]);

  if (!exercise) return null;

  // Includes newCue so a typed-but-not-added cue also counts as an unsaved
  // change — otherwise closing right after typing one would silently lose it.
  const currentSnapshot: Snapshot = {
    hasWarmup,
    warmupReps,
    progressionRule,
    cues,
    newCue,
    tags,
    newTag,
    instructionalLink,
    videoLink,
  };
  const isDirty = JSON.stringify(currentSnapshot) !== initialSnapshot;

  function addCue() {
    const trimmed = newCue.trim();
    if (!trimmed) return;
    setCues([...cues, trimmed]);
    setNewCue("");
  }

  function removeCue(index: number) {
    setCues(cues.filter((_, i) => i !== index));
  }

  function addTag() {
    const trimmed = newTag.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    setTags([...tags, trimmed]);
    setNewTag("");
  }

  function removeTag(index: number) {
    setTags(tags.filter((_, i) => i !== index));
  }

  function handleSave() {
    if (!exercise) return;
    updateExerciseDetails(exercise.id, {
      warmupReps: hasWarmup ? warmupReps : null,
      progressionRule: progressionRule.trim() || null,
      cues,
      tags,
      links: {
        instructional: instructionalLink.trim() || undefined,
        video: videoLink.trim() || undefined,
      },
    });
    closeEditDetails();
  }

  function requestClose() {
    if (isDirty) {
      setConfirmingDiscard(true);
    } else {
      closeEditDetails();
    }
  }

  if (confirmingDiscard) {
    return (
      <div className="sheet-backdrop" onClick={requestClose}>
        <div className="sheet" onClick={(e) => e.stopPropagation()}>
          <div className="discard-confirm">
            <div className="discard-confirm-text">Save Unsaved Changes?</div>
            <div className="discard-confirm-actions">
              <button type="button" className="confirm-discard-btn" onClick={closeEditDetails}>
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
    <div className="sheet-backdrop" onClick={requestClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <h2>Edit {exercise.name} Details</h2>
          <button type="button" className="sheet-close" onClick={requestClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="detail-field">
          <label className="toggle-row">
            <input type="checkbox" checked={hasWarmup} onChange={(e) => setHasWarmup(e.target.checked)} />
            This exercise has a warmup
          </label>
          {hasWarmup && (
            <Stepper label="Warmup Reps" value={warmupReps} unit="reps" min={1} step={1} onChange={setWarmupReps} />
          )}
        </div>

        <div className="detail-field">
          <div className="slider-label">Progression Rule</div>
          <input
            type="text"
            className="detail-input"
            value={progressionRule}
            onChange={(e) => setProgressionRule(e.target.value)}
            placeholder="e.g. Increase 2.5-5 lbs at a time"
          />
        </div>

        <div className="detail-field">
          <div className="slider-label">Form Cues</div>
          {cues.map((cue, i) => (
            <div key={i} className="cue-row">
              <div className="cue-text">{cue}</div>
              <button
                type="button"
                className="cue-remove"
                onClick={() => removeCue(i)}
                aria-label={`Remove cue: ${cue}`}
              >
                ×
              </button>
            </div>
          ))}
          <div className="cue-add-row">
            <input
              type="text"
              className="detail-input"
              value={newCue}
              onChange={(e) => setNewCue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCue();
                }
              }}
              placeholder="Add a cue"
            />
            <button type="button" className="cue-add-btn" onClick={addCue}>
              Add
            </button>
          </div>
        </div>

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

        <div className="detail-field">
          <div className="slider-label">Instructional Link</div>
          <input
            type="text"
            className="detail-input"
            value={instructionalLink}
            onChange={(e) => setInstructionalLink(e.target.value)}
            placeholder="https://..."
          />
        </div>

        <div className="detail-field">
          <div className="slider-label">Video Link</div>
          <input
            type="text"
            className="detail-input"
            value={videoLink}
            onChange={(e) => setVideoLink(e.target.value)}
            placeholder="https://..."
          />
        </div>

        <button type="button" className="save-btn" onClick={handleSave}>
          Save
        </button>
      </div>
    </div>
  );
}
