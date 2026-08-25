import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { formatLoad, formatWarmupLine, formatWorkingLine } from "../lib/format";
import { useData } from "../lib/DataContext";

const SWIPE_THRESHOLD_PX = 60;

type Direction = "next" | "prev";

export default function MovementDetail() {
  const { workoutId, exerciseId } = useParams<{ workoutId: string; exerciseId: string }>();
  const navigate = useNavigate();
  const { getExercise, getWorkout, openEditMode, openEditDetails } = useData();
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  // Drives the entrance animation's direction — set right before navigating,
  // so it's already correct by the time the new exercise's content mounts.
  const [direction, setDirection] = useState<Direction>("next");

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

  const warmupLine = formatWarmupLine(protocol.warmupSets, exercise);
  const historyPath = `/workouts/${workout.id}/exercises/${exercise.id}/history`;

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

        {warmupLine && (
          <div className="detail-section">
            <div className="detail-section-label">Warmup</div>
            <div>{warmupLine}</div>
          </div>
        )}

        <div className="detail-section">
          <div className="detail-section-label">Working Sets</div>
          {target.sides ? (
            <div className="side-detail-grid">
              <div>
                <strong>Left</strong>
                <div>
                  {target.sides.left.reps} reps @ {formatLoad(target.sides.left.load)}
                </div>
                {target.sides.left.tempo && <div className="tempo-note">{target.sides.left.tempo}</div>}
              </div>
              <div>
                <strong>Right</strong>
                <div>
                  {target.sides.right.reps} reps @ {formatLoad(target.sides.right.load)}
                </div>
                {target.sides.right.tempo && <div className="tempo-note">{target.sides.right.tempo}</div>}
              </div>
            </div>
          ) : (
            <div>{formatWorkingLine(protocol.workingSets, target)}</div>
          )}
        </div>

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

        <div className="detail-actions">
          <button type="button" className="edit-btn" onClick={() => openEditMode(exercise.id)}>
            Edit reps/weight
          </button>
          <Link to={historyPath}>View History</Link>
        </div>
        <button type="button" className="history-link" onClick={() => openEditDetails(exercise.id)}>
          Edit Details
        </button>
      </div>
    </div>
  );
}
