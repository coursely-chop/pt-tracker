import { useRef } from "react";
import { Link } from "react-router-dom";
import { lastCompletedDate } from "../lib/completions";
import { formatDate } from "../lib/format";
import { useData } from "../lib/DataContext";
import heroImage from "../assets/home-hero.jpg";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function HomeWorkoutList() {
  const { workouts, completions } = useData();
  const listRef = useRef<HTMLDivElement>(null);

  function scrollToList() {
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="screen">
      <div className="home-page-bg-frame" aria-hidden="true">
        <div className="home-page-bg" style={{ backgroundImage: `url(${heroImage})` }} />
      </div>
      <div className="home-hero">
        <Link to="/equipment" className="icon-link home-hero-equipment" aria-label="Equipment">
          <svg viewBox="0 -960 960 960" width="20" height="20" fill="currentColor" aria-hidden="true">
            <path d="m536-84-56-56 142-142-340-340-142 142-56-56 56-58-56-56 84-84-56-58 56-56 58 56 84-84 56 56 58-56 56 56-142 142 340 340 142-142 56 56-56 58 56 56-84 84 56 58-56 56-58-56-84 84-56-56-58 56Z" />
          </svg>
        </Link>
        <div className="home-hero-greeting">{getGreeting()}, Ben</div>
        <div className="home-hero-ctas">
          <button type="button" className="home-hero-cta home-hero-cta-primary" onClick={scrollToList}>
            Home Workout
          </button>
          <button type="button" className="home-hero-cta home-hero-cta-disabled" disabled>
            Gym Workout
            <span className="home-hero-badge">Coming soon</span>
          </button>
        </div>
      </div>

      <div ref={listRef}>
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
      <Link to="/workouts/new" className="fab" aria-label="Create new home workout">
        +
      </Link>
    </div>
  );
}
