import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { SetLinesLabel, SetLinesRows } from "../components/SetLines";
import { formatDate, getWarmupLines, getWorkingLines, localDateISO, todayISO } from "../lib/format";
import ExerciseIcon from "../components/ExerciseIcon";
import { useData } from "../lib/DataContext";
import { resolveExerciseIcon } from "../lib/exerciseIcons";
import { homePath } from "../lib/homeTab";

export default function WorkoutOverview() {
  const { workoutId } = useParams<{ workoutId: string }>();
  const navigate = useNavigate();
  const { getExercise, getWorkout, openEditMode, logWorkout, equipment } = useData();
  const workout = workoutId ? getWorkout(workoutId) : undefined;
  const [armed, setArmed] = useState(false);
  const [pastDate, setPastDate] = useState<string | null>(null);

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

  function handleConfirmLog(date?: string) {
    if (!workout) return;
    logWorkout(workout.id, date);
    navigate(homePath(workout.type));
  }

  function cancelLogging() {
    setArmed(false);
    setPastDate(null);
  }

  return (
    <div className="screen">
      <Link to={homePath(workout.type)} className="back-link">
        ← {workout.type === "gym" ? "Gym Workouts" : "Home Workouts"}
      </Link>
      <div className="movement-header">
        <h1 className="screen-title">
          {workout.emoji && (
            <span className="workout-title-emoji" aria-hidden="true">
              {workout.emoji}
            </span>
          )}
          {workout.name}
        </h1>
        <Link to={`/workouts/${workout.id}/edit`} className="icon-link" aria-label="Edit workout">
          <svg viewBox="0 -960 960 960" width="18" height="18" fill="currentColor" aria-hidden="true">
            <path d="M200-200h56l345-345-56-56-345 345v56Zm572-403L602-771l56-56q23-23 56.5-23t56.5 23l56 56q23 23 24 55.5T829-660l-57 57Zm-58 59L290-120H120v-170l424-424 170 170Z" />
          </svg>
        </Link>
      </div>

      {pastDate !== null ? (
        <div className="log-workout-wrap">
          <div className="log-workout log-workout-confirm">
            <input
              type="date"
              className="log-workout-date"
              value={pastDate}
              max={localDateISO()}
              onChange={(e) => setPastDate(e.target.value)}
              aria-label="Date the workout was done"
            />
            <button
              type="button"
              className="log-workout-confirm-main log-workout-record"
              disabled={!pastDate}
              onClick={() => handleConfirmLog(pastDate)}
            >
              Record
            </button>
            <button type="button" className="log-workout-cancel" onClick={cancelLogging} aria-label="Cancel logging workout">
              ×
            </button>
          </div>
        </div>
      ) : armed ? (
        <div className="log-workout-wrap">
          <div className="log-workout log-workout-confirm">
            <button type="button" className="log-workout-confirm-main" onClick={() => handleConfirmLog()}>
              Record Workout on {formatDate(todayISO())}
            </button>
            <button type="button" className="log-workout-cancel" onClick={cancelLogging} aria-label="Cancel logging workout">
              ×
            </button>
          </div>
          <button type="button" className="log-workout-past-link" onClick={() => setPastDate(localDateISO())}>
            Log for a different day
          </button>
        </div>
      ) : (
        <div className="log-workout-wrap">
          <button type="button" className="log-workout" onClick={() => setArmed(true)}>
            Log Workout
          </button>
        </div>
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
                    const warmupLines = getWarmupLines(protocol.warmupSets, exercise, equipment, workout.type === "gym");
                    const workingLines = getWorkingLines(
                      protocol.workingSets,
                      exercise.targets[workout.type === "gym" ? "gym" : "home"]
                    );

                    return (
                      <div key={exerciseId} className="slot-card">
                        <Link to={`/workouts/${workout.id}/exercises/${exerciseId}`} className="exercise-name">
                          <ExerciseIcon icon={resolveExerciseIcon(exercise, workout.type)} size={20} className="exercise-name-icon" />
                          <span>{exercise.name}</span>
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
