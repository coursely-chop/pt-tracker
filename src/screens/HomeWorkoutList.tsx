import { Link } from "react-router-dom";
import { useData } from "../lib/DataContext";

export default function HomeWorkoutList() {
  const { workouts } = useData();

  return (
    <div className="screen">
      <h1 className="screen-title">Home Workouts</h1>
      {workouts.map((workout) => (
        <Link key={workout.id} to={`/workouts/${workout.id}`} className="workout-card">
          <div className="workout-card-name">{workout.name}</div>
          <div className="workout-card-meta">Last completed: not tracked yet</div>
        </Link>
      ))}
    </div>
  );
}
