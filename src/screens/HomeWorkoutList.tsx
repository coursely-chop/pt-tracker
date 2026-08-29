import { Link } from "react-router-dom";
import { lastCompletedDate } from "../lib/completions";
import { formatDate } from "../lib/format";
import { useData } from "../lib/DataContext";

export default function HomeWorkoutList() {
  const { workouts, completions } = useData();

  return (
    <div className="screen">
      <div className="movement-header">
        <h1 className="screen-title">Home Workouts</h1>
        <Link to="/equipment" className="icon-link" aria-label="Equipment">
          <svg viewBox="0 -960 960 960" width="20" height="20" fill="currentColor" aria-hidden="true">
            <path d="m536-84-56-56 142-142-340-340-142 142-56-56 56-58-56-56 84-84-56-58 56-56 58 56 84-84 56 56 58-56 56 56-142 142 340 340 142-142 56 56-56 58 56 56-84 84 56 58-56 56-58-56-84 84-56-56-58 56Z" />
          </svg>
        </Link>
      </div>
      {workouts.map((workout) => {
        const last = lastCompletedDate(completions, workout.id);
        return (
          <Link key={workout.id} to={`/workouts/${workout.id}`} className="workout-card">
            <div className="workout-card-name">{workout.name}</div>
            <div className="workout-card-meta">Last completed: {last ? formatDate(last) : "Never"}</div>
          </Link>
        );
      })}
      <Link to="/workouts/new" className="fab" aria-label="Create new home workout">
        +
      </Link>
    </div>
  );
}
