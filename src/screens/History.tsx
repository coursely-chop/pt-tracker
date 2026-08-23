import { Link, useParams } from "react-router-dom";
import HistoryChart from "../components/HistoryChart";
import { formatDate } from "../lib/format";
import { getHistoryData } from "../lib/history";
import { useData } from "../lib/DataContext";

export default function History() {
  const { workoutId, exerciseId } = useParams<{ workoutId: string; exerciseId: string }>();
  const { getExercise, getWorkout } = useData();

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

  const { points, skippedCount } = getHistoryData(exercise);
  const hasSides = points.some((p) => p.side);
  const movementPath = `/workouts/${workout.id}/exercises/${exercise.id}`;

  return (
    <div className="screen">
      <Link to={movementPath} className="back-link">
        ← {exercise.name}
      </Link>
      <h1 className="screen-title">History</h1>

      {points.length === 0 && <p className="empty-state">No progression history yet — this fills in as you adjust reps/weight over time.</p>}

      {points.length === 1 && (
        <p className="empty-state">
          Just one data point so far — {points[0].weight} lbs @ {points[0].reps} reps on{" "}
          {formatDate(points[0].date)}. A trend will show up after your next change.
        </p>
      )}

      {points.length > 1 && (
        <>
          <HistoryChart points={points} />
          {hasSides && (
            <div className="chart-legend">
              <span className="legend-item">
                <span className="legend-swatch chart-series-left" /> Left
              </span>
              <span className="legend-item">
                <span className="legend-swatch chart-series-right" /> Right
              </span>
            </div>
          )}
        </>
      )}

      {skippedCount > 0 && (
        <p className="chart-note">
          {skippedCount} earlier {skippedCount === 1 ? "entry" : "entries"} recorded only weight or only reps, not
          both — not shown on the chart.
        </p>
      )}

      <div className="detail-actions">
        <Link to={movementPath} className="edit-btn">
          Back to {exercise.name}
        </Link>
        <Link to={`/workouts/${workout.id}`} className="next-btn">
          Workout Overview
        </Link>
      </div>
    </div>
  );
}
