import { useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { SetLinesLabel, SetLinesRows } from "../components/SetLines";
import { formatDate, getWarmupLines, getWorkingLines } from "../lib/format";
import { notesForExercise } from "../lib/notes";
import { useData } from "../lib/DataContext";
import type { Note } from "../types";

const SWIPE_THRESHOLD_PX = 60;

type Direction = "next" | "prev";

function PencilIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11.5 2.5l2 2-7.5 7.5H3.5v-2.5z" />
    </svg>
  );
}

function PinIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="21" height="21" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
      <circle cx="8" cy="6" r="3.2" fill={filled ? "currentColor" : "none"} />
      <line x1="8" y1="9.2" x2="8" y2="14" />
    </svg>
  );
}

export default function MovementDetail() {
  const { workoutId, exerciseId } = useParams<{ workoutId: string; exerciseId: string }>();
  const navigate = useNavigate();
  const {
    getExercise,
    getWorkout,
    openEditMode,
    openEditDetails,
    notes,
    addNote,
    updateNoteText,
    toggleNotePinned,
    deleteNote,
    equipment,
  } = useData();
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  // Drives the entrance animation's direction — set right before navigating,
  // so it's already correct by the time the new exercise's content mounts.
  const [direction, setDirection] = useState<Direction>("next");
  const [addingNote, setAddingNote] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");
  const [confirmingDeleteNoteId, setConfirmingDeleteNoteId] = useState<string | null>(null);
  const [justPinnedId, setJustPinnedId] = useState<string | null>(null);
  const noteCardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  // Only set right before a pin/unpin call, and consumed (cleared) by the FLIP
  // effect below — this is what keeps unrelated re-renders (opening an edit
  // view, typing, adding a note) from triggering a reorder animation.
  const pendingFlipRectsRef = useRef<Map<string, DOMRect> | null>(null);

  const workout = workoutId ? getWorkout(workoutId) : undefined;
  const exercise = exerciseId ? getExercise(exerciseId) : undefined;

  if (!workout || !exercise) {
    return (
      <div className="screen">
        <Link to="/" className="back-link">
          ← Home Workouts
        </Link>
        <p>Not found.</p>
      </div>
    );
  }

  const { protocol } = workout.structure;
  const { target } = exercise;

  const slots = [...workout.supersets]
    .sort((a, b) => a.order - b.order)
    .flatMap((s) => [...s.slots].sort((a, b) => a.order - b.order));
  const slotIndex = slots.findIndex((slot) => slot.exerciseIds.includes(exercise.id));
  const previousExerciseId = slotIndex > 0 ? slots[slotIndex - 1]?.exerciseIds[0] : undefined;
  const nextExerciseId = slotIndex >= 0 ? slots[slotIndex + 1]?.exerciseIds[0] : undefined;

  const warmupLines = getWarmupLines(protocol.warmupSets, exercise, equipment);
  const workingLines = getWorkingLines(protocol.workingSets, target);
  const historyPath = `/workouts/${workout.id}/exercises/${exercise.id}/history`;
  const exerciseNotes = notesForExercise(notes, exercise.id);
  // While a note is being added or edited, the primary actions below step aside —
  // one thing to finish at a time, instead of competing CTAs.
  const noteEditorOpen = addingNote || editingNoteId !== null;

  // FLIP: reorder animation for pin/unpin only. This effect runs after every
  // render, but no-ops unless handleTogglePin just stashed "before" rects —
  // that's what stops an unrelated re-render (opening an edit view, typing,
  // adding a note) from reading as a reorder and animating cards that only
  // moved because a sibling's height changed.
  useLayoutEffect(() => {
    const prevRects = pendingFlipRectsRef.current;
    if (!prevRects) return;
    pendingFlipRectsRef.current = null;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    noteCardRefs.current.forEach((el, id) => {
      const prev = prevRects.get(id);
      if (!prev) return;
      const next = el.getBoundingClientRect();
      const deltaY = prev.top - next.top;
      if (Math.abs(deltaY) < 1) return;
      el.style.transition = "none";
      el.style.transform = `translateY(${deltaY}px)`;
      requestAnimationFrame(() => {
        el.style.transition = "transform 280ms cubic-bezier(0.16, 1, 0.3, 1)";
        el.style.transform = "";
      });
    });
  });

  function handleTogglePin(note: Note) {
    const rects = new Map<string, DOMRect>();
    noteCardRefs.current.forEach((el, id) => rects.set(id, el.getBoundingClientRect()));
    pendingFlipRectsRef.current = rects;
    if (!note.pinned) setJustPinnedId(note.id);
    toggleNotePinned(note.id);
  }

  // Only one note editor (add, or an existing note's edit view) is open at a time.
  function startAddingNote() {
    setEditingNoteId(null);
    setConfirmingDeleteNoteId(null);
    setNewNoteText("");
    setAddingNote(true);
  }

  function startEditingNote(note: Note) {
    setAddingNote(false);
    setConfirmingDeleteNoteId(null);
    setEditingNoteText(note.text);
    setEditingNoteId(note.id);
  }

  function handleSaveNote() {
    const trimmed = newNoteText.trim();
    if (!trimmed || !exercise) return;
    addNote(exercise.id, trimmed);
    setNewNoteText("");
    setAddingNote(false);
  }

  function handleSaveEditedNote() {
    const trimmed = editingNoteText.trim();
    if (!trimmed || !editingNoteId) return;
    updateNoteText(editingNoteId, trimmed);
    setEditingNoteId(null);
  }

  function handleConfirmDelete() {
    if (!confirmingDeleteNoteId) return;
    deleteNote(confirmingDeleteNoteId);
    setConfirmingDeleteNoteId(null);
    setEditingNoteId(null);
  }

  function goToExercise(id: string | undefined, dir: Direction) {
    if (!workout || !id) return;
    setDirection(dir);
    navigate(`/workouts/${workout.id}/exercises/${id}`);
  }

  function handleTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;

    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // Require a clearly horizontal, deliberate swipe so scrolling and taps are never mistaken for one.
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy)) return;

    if (dx < 0) {
      goToExercise(nextExerciseId, "next");
    } else {
      goToExercise(previousExerciseId, "prev");
    }
  }

  return (
    <div className="screen" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <Link to={`/workouts/${workout.id}`} className="back-link">
        ← {workout.name}
      </Link>

      <div key={exercise.id} className={`movement-content slide-${direction}`}>
        <div className="movement-header">
          <h1 className="screen-title">{exercise.name}</h1>
          <div className="swipe-cluster">
            <button
              type="button"
              className="swipe-cluster-btn"
              disabled={!previousExerciseId}
              onClick={() => goToExercise(previousExerciseId, "prev")}
              aria-label="Previous movement"
            >
              ‹
            </button>
            <button
              type="button"
              className="swipe-cluster-btn"
              disabled={!nextExerciseId}
              onClick={() => goToExercise(nextExerciseId, "next")}
              aria-label="Next movement"
            >
              ›
            </button>
          </div>
        </div>

        {(exercise.links.instructional || exercise.links.video) && (
          <details className="media-section">
            <summary>Media &amp; links</summary>
            {exercise.links.instructional && (
              <a href={exercise.links.instructional} target="_blank" rel="noreferrer">
                Instructional article
              </a>
            )}
            {exercise.links.video && (
              <a href={exercise.links.video} target="_blank" rel="noreferrer">
                Video
              </a>
            )}
          </details>
        )}

        {warmupLines ? (
          <button
            type="button"
            className="detail-section detail-set-lines-btn"
            aria-label={`Edit ${exercise.name} warmup`}
            disabled={noteEditorOpen}
            onClick={() => openEditMode(exercise.id, workout.type === "gym")}
          >
            <div className="detail-section-label">
              <SetLinesLabel label="Warmup" sets={warmupLines.sets} />
            </div>
            <SetLinesRows lines={warmupLines} />
          </button>
        ) : (
          <button
            type="button"
            className="detail-section detail-set-lines-btn"
            aria-label={`Edit ${exercise.name} warmup`}
            disabled={noteEditorOpen}
            onClick={() => openEditMode(exercise.id, workout.type === "gym")}
          >
            <div className="detail-section-label">Warmup</div>
            <div className="set-line-none">None required</div>
          </button>
        )}

        <button
          type="button"
          className="detail-section detail-set-lines-btn"
          aria-label={`Edit ${exercise.name} working set reps and weight`}
          disabled={noteEditorOpen}
          onClick={() => openEditMode(exercise.id, workout.type === "gym")}
        >
          <div className="detail-section-label">
            <SetLinesLabel label="Working" sets={protocol.workingSets} />
          </div>
          <SetLinesRows lines={workingLines} />
          {target.sides && (target.sides.left.tempo || target.sides.right.tempo) && (
            <div className="side-tempo-notes">
              {target.sides.left.tempo && <div className="tempo-note">L: {target.sides.left.tempo}</div>}
              {target.sides.right.tempo && <div className="tempo-note">R: {target.sides.right.tempo}</div>}
            </div>
          )}
        </button>

        {exercise.asymmetryNote && <div className="note-callout">{exercise.asymmetryNote}</div>}

        {exercise.cues.length > 0 && (
          <div className="detail-section">
            <div className="detail-section-label">Form Cues</div>
            <ul>
              {exercise.cues.map((cue, i) => (
                <li key={i}>{cue}</li>
              ))}
            </ul>
          </div>
        )}

        {exercise.progressionRule && (
          <div className="detail-section">
            <div className="detail-section-label">Progression</div>
            <div>{exercise.progressionRule}</div>
          </div>
        )}

        <div className="detail-section">
          <div className="detail-section-label">Notes</div>
          {exerciseNotes.map((note) => {
            const isEditing = editingNoteId === note.id;
            const isConfirmingDelete = confirmingDeleteNoteId === note.id;

            return (
              <div
                key={note.id}
                ref={(el) => {
                  if (el) noteCardRefs.current.set(note.id, el);
                  else noteCardRefs.current.delete(note.id);
                }}
                className={`note-card${note.id === justPinnedId ? " note-card-pin-flash" : ""}`}
                onAnimationEnd={() => setJustPinnedId((id) => (id === note.id ? null : id))}
              >
                {isConfirmingDelete ? (
                  <div className="discard-confirm">
                    <div className="discard-confirm-text" style={{ fontSize: 15 }}>
                      Delete this note?
                    </div>
                    <div className="discard-confirm-actions">
                      <button
                        type="button"
                        className="discard-cancel-btn"
                        onClick={() => setConfirmingDeleteNoteId(null)}
                      >
                        Cancel
                      </button>
                      <button type="button" className="discard-btn" onClick={handleConfirmDelete}>
                        Delete
                      </button>
                    </div>
                  </div>
                ) : isEditing ? (
                  <>
                    <div className="note-row-meta">
                      <span className="note-date">{formatDate(note.createdAt.slice(0, 10))}</span>
                      <button
                        type="button"
                        className="note-icon-btn note-icon-btn-solo"
                        onClick={() => setEditingNoteId(null)}
                        aria-label="Cancel editing"
                      >
                        ×
                      </button>
                    </div>
                    <textarea
                      className="detail-textarea"
                      value={editingNoteText}
                      onChange={(e) => setEditingNoteText(e.target.value)}
                      rows={2}
                      autoFocus
                    />
                    <div className="note-edit-actions">
                      <button
                        type="button"
                        className="note-delete-btn"
                        onClick={() => setConfirmingDeleteNoteId(note.id)}
                      >
                        Delete Note
                      </button>
                      <button type="button" className="note-save-btn" onClick={handleSaveEditedNote}>
                        Save Changes
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="note-row-meta">
                      <span className="note-date">{formatDate(note.createdAt.slice(0, 10))}</span>
                      <div className="note-icon-cluster">
                        <button
                          type="button"
                          className="note-icon-btn"
                          onClick={() => startEditingNote(note)}
                          aria-label="Edit note"
                        >
                          <PencilIcon />
                        </button>
                        <button
                          type="button"
                          className={`note-icon-btn${note.pinned ? " pinned" : ""}`}
                          onClick={() => handleTogglePin(note)}
                          aria-label={note.pinned ? "Unpin note" : "Pin note"}
                        >
                          <PinIcon filled={note.pinned} />
                        </button>
                      </div>
                    </div>
                    <div className="note-text">{note.text}</div>
                  </>
                )}
              </div>
            );
          })}

          {addingNote && (
            <div className="note-card">
              <textarea
                className="detail-textarea"
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                placeholder="Guidance or how this session felt..."
                rows={2}
                autoFocus
              />
              <div className="note-add-actions">
                <button
                  type="button"
                  className="note-add-cancel"
                  onClick={() => {
                    setAddingNote(false);
                    setNewNoteText("");
                  }}
                >
                  Cancel
                </button>
                <button type="button" className="note-add-save" onClick={handleSaveNote}>
                  Save
                </button>
              </div>
            </div>
          )}

          {!addingNote && editingNoteId === null && (
            <button type="button" className="add-note-trigger" onClick={startAddingNote}>
              + Add Note
            </button>
          )}
        </div>

        <div className="detail-actions">
          <Link
            to={historyPath}
            className={noteEditorOpen ? "disabled-link" : undefined}
            aria-disabled={noteEditorOpen}
            tabIndex={noteEditorOpen ? -1 : undefined}
          >
            View History
          </Link>
        </div>
        <button
          type="button"
          className="history-link"
          disabled={noteEditorOpen}
          onClick={() => openEditDetails(exercise.id)}
        >
          Edit Details
        </button>
      </div>
    </div>
  );
}
