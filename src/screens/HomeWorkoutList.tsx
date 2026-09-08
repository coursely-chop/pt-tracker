import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { lastCompletedDate } from "../lib/completions";
import { formatDate } from "../lib/format";
import { useData } from "../lib/DataContext";
import type { Workout } from "../types";
import kettlebellIllustration from "../assets/happy-kettlebell.svg";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function HomeWorkoutList() {
  const { workouts, completions, profile } = useData();
  const listRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<Workout["type"]>("home");

  function selectTab(tab: Workout["type"]) {
    setActiveTab(tab);
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const visibleWorkouts = workouts.filter((w) => w.type === activeTab);

  return (
    <div className="screen">
      <div className="home-page-bg-frame" aria-hidden="true">
        <img src={kettlebellIllustration} alt="" className="home-page-bg" />
      </div>
      <div className="home-hero">
        <div className="home-hero-greeting">
          {getGreeting()}, {profile.name}
        </div>
        <div className="home-hero-ctas">
          <button
            type="button"
            className={`home-hero-cta${activeTab === "home" ? " home-hero-cta-primary" : " home-hero-cta-secondary"}`}
            onClick={() => selectTab("home")}
          >
            Home Workout
          </button>
          <button
            type="button"
            className={`home-hero-cta${activeTab === "gym" ? " home-hero-cta-primary" : " home-hero-cta-secondary"}`}
            onClick={() => selectTab("gym")}
          >
            Gym Workout
          </button>
        </div>
      </div>

      <div ref={listRef}>
        {visibleWorkouts.map((workout) => {
          const last = lastCompletedDate(completions, workout.id);
          return (
            <Link key={workout.id} to={`/workouts/${workout.id}`} className="workout-card">
              <div className="workout-card-name">{workout.name}</div>
              <div className="workout-card-meta">Last completed: {last ? formatDate(last) : "Never"}</div>
            </Link>
          );
        })}
        {visibleWorkouts.length === 0 && (
          <p className="hint-box screen-intro">
            No {activeTab === "gym" ? "gym" : "home"} workouts yet — tap + to create one.
          </p>
        )}
      </div>

      <Link to="/settings" className="icon-link settings-fab" aria-label="Settings">
        <svg viewBox="0 -960 960 960" width="20" height="20" fill="currentColor" aria-hidden="true">
          <path d="m370-80-16-128q-13-5-24.5-12T307-235l-119 50L78-375l103-78q-1-7-1-13.5v-27q0-6.5 1-13.5L78-585l110-190 119 50q11-8 23-15t24-12l16-128h220l16 128q13 5 24.5 12t22.5 15l119-50 110 190-103 78q1 7 1 13.5v27q0 6.5-2 13.5l103 78-110 190-118-50q-11 8-23 15t-24 12L590-80H370Zm112-260q58 0 99-41t41-99q0-58-41-99t-99-41q-59 0-99.5 41T342-480q0 58 40.5 99t99.5 41Z" />
        </svg>
      </Link>
      <Link
        to={activeTab === "gym" ? "/workouts/new?type=gym" : "/workouts/new"}
        className="fab"
        aria-label={`Create new ${activeTab === "gym" ? "gym" : "home"} workout`}
      >
        +
      </Link>
    </div>
  );
}
