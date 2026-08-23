import { Link } from "react-router-dom";
import { lastCompletedDate } from "../lib/completions";
import { formatDate } from "../lib/format";
import { useData } from "../lib/DataContext";

export default function HomeWorkoutList() {
  const { workouts, completions } = useData();

  return (
    <div className="screen">
      <h1 className="screen-title">Home Workouts</h1>
      {workouts.map((workout) => {
        const last = lastCompletedDate(completions, workout.id);
        return (
          <Link key={workout.id} to={`/workouts/${workout.id}`} className="workout-card">
            <div className="workout-card-name">{workout.name}</div>
            <div className="workout-card-meta">Last completed: {last ? formatDate(last) : "Never"}</div>
          </Link>
        );
      })}
    </div>
  );
}
