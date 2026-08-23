import { Link, useParams } from "react-router-dom";
import { formatWarmupLine, formatWorkingLine } from "../lib/format";
import { useData } from "../lib/DataContext";

export default function WorkoutOverview() {
  const { workoutId } = useParams<{ workoutId: string }>();
  const { getExercise, getWorkout, openEditMode } = useData();
  const workout = workoutId ? getWorkout(workoutId) : undefined;

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

  return (
    <div className="screen">
      <Link to="/" className="back-link">
        ← Home Workouts
      </Link>
      <h1 className="screen-title">{workout.name}</h1>

      <div className="stretching-note">{workout.structure.dynamicStretching}</div>

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
                    const warmupLine = formatWarmupLine(protocol.warmupSets, exercise);
                    const workingLine = formatWorkingLine(protocol.workingSets, exercise.target);

                    return (
                      <div key={exerciseId} className="slot-card">
                        <Link to={`/workouts/${workout.id}/exercises/${exerciseId}`} className="exercise-name">
                          {exercise.name}
                        </Link>
                        <button
                          type="button"
                          className="set-lines-btn"
                          aria-label={`Edit ${exercise.name} reps and weight`}
                          onClick={() => openEditMode(exerciseId)}
                        >
                          {warmupLine && (
                            <div className="set-line">
                              <span className="set-line-label">Warmup</span>
                              {warmupLine}
                            </div>
                          )}
                          <div className="set-line">
                            <span className="set-line-label">Working</span>
                            {workingLine}
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
