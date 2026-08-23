import { Link, useNavigate, useParams } from "react-router-dom";
import { formatLoad, formatRepsTarget, formatWarmupLine } from "../lib/format";
import { useData } from "../lib/DataContext";

export default function MovementDetail() {
  const { workoutId, exerciseId } = useParams<{ workoutId: string; exerciseId: string }>();
  const navigate = useNavigate();
  const { getExercise, getWorkout, openEditMode } = useData();

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
  const nextExerciseId = slotIndex >= 0 ? slots[slotIndex + 1]?.exerciseIds[0] : undefined;

  const warmupLine = formatWarmupLine(protocol.warmupSets, exercise);

  return (
    <div className="screen">
      <Link to={`/workouts/${workout.id}`} className="back-link">
        ← {workout.name}
      </Link>
      <h1 className="screen-title">{exercise.name}</h1>

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
          <div>
            {protocol.workingSets}x{" "}
            {target.reps != null
              ? formatRepsTarget(target.reps, target.repUnit)
              : `${target.repRange.min}-${target.repRange.max} reps`}{" "}
            @ {target.load ? formatLoad(target.load) : "—"}
          </div>
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
        {nextExerciseId && (
          <button
            type="button"
            className="next-btn"
            onClick={() => navigate(`/workouts/${workout.id}/exercises/${nextExerciseId}`)}
          >
            Next Movement →
          </button>
        )}
      </div>
      <Link to={`/workouts/${workout.id}/exercises/${exercise.id}/history`} className="history-link">
        View History
      </Link>
    </div>
  );
}
