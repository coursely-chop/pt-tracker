import { useEffect, useState } from "react";
import { useData } from "../lib/DataContext";

interface Snapshot {
  warmup: string;
  progressionRule: string;
  cues: string[];
  newCue: string;
  instructionalLink: string;
  videoLink: string;
}

export default function EditDetailsSheet() {
  const { editingDetailsExerciseId, closeEditDetails, getExercise, updateExerciseDetails } = useData();
  const exercise = editingDetailsExerciseId ? getExercise(editingDetailsExerciseId) : undefined;

  const [warmup, setWarmup] = useState("");
  const [progressionRule, setProgressionRule] = useState("");
  const [cues, setCues] = useState<string[]>([]);
  const [newCue, setNewCue] = useState("");
  const [instructionalLink, setInstructionalLink] = useState("");
  const [videoLink, setVideoLink] = useState("");
  const [initialSnapshot, setInitialSnapshot] = useState("");
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  // Re-initialize only when a (possibly different) exercise is opened.
  useEffect(() => {
    if (!exercise) return;
    const snapshot: Snapshot = {
      warmup: exercise.warmup ?? "",
      progressionRule: exercise.progressionRule ?? "",
      cues: exercise.cues,
      newCue: "",
      instructionalLink: exercise.links.instructional ?? "",
      videoLink: exercise.links.video ?? "",
    };
    setWarmup(snapshot.warmup);
    setProgressionRule(snapshot.progressionRule);
    setCues(snapshot.cues);
    setNewCue("");
    setInstructionalLink(snapshot.instructionalLink);
    setVideoLink(snapshot.videoLink);
    setInitialSnapshot(JSON.stringify(snapshot));
    setConfirmingDiscard(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingDetailsExerciseId]);

  if (!exercise) return null;

  // Includes newCue so a typed-but-not-added cue also counts as an unsaved
  // change — otherwise closing right after typing one would silently lose it.
  const currentSnapshot: Snapshot = { warmup, progressionRule, cues, newCue, instructionalLink, videoLink };
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

  function handleSave() {
    if (!exercise) return;
    updateExerciseDetails(exercise.id, {
      warmup: warmup.trim() || null,
      progressionRule: progressionRule.trim() || null,
      cues,
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
            <div className="discard-confirm-text">Discard unsaved changes?</div>
            <div className="discard-confirm-actions">
              <button type="button" className="discard-cancel-btn" onClick={() => setConfirmingDiscard(false)}>
                Cancel
              </button>
              <button type="button" className="discard-btn" onClick={closeEditDetails}>
                Discard
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
          <div className="slider-label">Warmup</div>
          <textarea
            className="detail-textarea"
            value={warmup}
            onChange={(e) => setWarmup(e.target.value)}
            placeholder="e.g. 50-75% of working weight for 10 reps each side"
            rows={2}
          />
          {exercise.warmupSpec && (
            <div className="detail-hint">
              This exercise's warmup weight is calculated automatically from your equipment (see the "Home
              equipment" section in the PRD) whenever the load is a free weight. This text is only shown as a
              fallback — it won't appear unless that stops applying.
            </div>
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
