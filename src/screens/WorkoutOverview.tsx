import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { SetLinesLabel, SetLinesRows } from "../components/SetLines";
import { formatDate, getWarmupLines, getWorkingLines, todayISO } from "../lib/format";
import { useData } from "../lib/DataContext";

export default function WorkoutOverview() {
  const { workoutId } = useParams<{ workoutId: string }>();
  const navigate = useNavigate();
  const { getExercise, getWorkout, openEditMode, logWorkout, equipment } = useData();
  const workout = workoutId ? getWorkout(workoutId) : undefined;
  const [armed, setArmed] = useState(false);

  if (!workout) {
    return (
      <div className="screen">
        <Link to="/" className="back-link">
          ← Home Workouts
        </Link>
        <p>Workout not found.</p>
      </div>
    );
  }

  const { protocol } = workout.structure;
  const supersets = [...workout.supersets].sort((a, b) => a.order - b.order);

  function handleConfirmLog() {
    if (!workout) return;
    logWorkout(workout.id);
    navigate("/");
  }

  return (
    <div className="screen">
      <Link to="/" className="back-link">
        ← {workout.type === "gym" ? "Gym Workouts" : "Home Workouts"}
      </Link>
      <div className="movement-header">
        <h1 className="screen-title">{workout.name}</h1>
        <Link to={`/workouts/${workout.id}/edit`} className="icon-link" aria-label="Edit workout">
          <svg viewBox="0 -960 960 960" width="18" height="18" fill="currentColor" aria-hidden="true">
            <path d="M200-200h56l345-345-56-56-345 345v56Zm572-403L602-771l56-56q23-23 56.5-23t56.5 23l56 56q23 23 24 55.5T829-660l-57 57Zm-58 59L290-120H120v-170l424-424 170 170Z" />
          </svg>
        </Link>
      </div>

      {armed ? (
        <div className="log-workout log-workout-confirm">
          <button type="button" className="log-workout-confirm-main" onClick={handleConfirmLog}>
            Record Workout on {formatDate(todayISO())}
          </button>
          <button
            type="button"
            className="log-workout-cancel"
            onClick={() => setArmed(false)}
            aria-label="Cancel logging workout"
          >
            ×
          </button>
        </div>
      ) : (
        <button type="button" className="log-workout" onClick={() => setArmed(true)}>
          Log Workout
        </button>
      )}

      {supersets.map((superset) => (
        <div key={superset.order} className="superset">
          <div className="superset-label">Superset {superset.order}</div>
          {[...superset.slots]
            .sort((a, b) => a.order - b.order)
            .map((slot) => {
              const hasAlternates = slot.exerciseIds.length > 1;
              return (
                <div key={slot.order} className="slot" data-swipe={hasAlternates}>
                  {slot.exerciseIds.map((exerciseId) => {
                    const exercise = getExercise(exerciseId);
                    if (!exercise) return null;
                    const warmupLines = getWarmupLines(protocol.warmupSets, exercise, equipment);
                    const workingLines = getWorkingLines(protocol.workingSets, exercise.target);

                    return (
                      <div key={exerciseId} className="slot-card">
                        <Link to={`/workouts/${workout.id}/exercises/${exerciseId}`} className="exercise-name">
                          {exercise.name}
                        </Link>
                        <button
                          type="button"
                          className="set-lines-row set-lines-btn"
                          aria-label={`Edit ${exercise.name} warmup and working sets`}
                          onClick={() => openEditMode(exerciseId, workout.type === "gym")}
                        >
                          <div className="set-line-panel">
                            <span className="set-line-label">
                              {warmupLines ? <SetLinesLabel label="Warmup" sets={warmupLines.sets} /> : "Warmup"}
                            </span>
                            {warmupLines ? (
                              <SetLinesRows lines={warmupLines} />
                            ) : (
                              <div className="set-line-none">None required</div>
                            )}
                          </div>
                          <div className="set-line-panel">
                            <span className="set-line-label">
                              <SetLinesLabel label="Working" sets={workingLines.sets} />
                            </span>
                            <SetLinesRows lines={workingLines} />
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
        </div>
      ))}
    </div>
  );
}
