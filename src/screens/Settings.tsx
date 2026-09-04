import { useState } from "react";
import { Link } from "react-router-dom";
import EquipmentSection from "./EquipmentSection";
import { useData } from "../lib/DataContext";

type Tab = "equipment" | "general";

/** Equipment defaults to selected (not "general") since it's the only
 * section with real content today — an empty "General" landing would look
 * broken on first visit. */
export default function Settings() {
  const [tab, setTab] = useState<Tab>("equipment");
  const { profile, setProfileName } = useData();

  return (
    <div className="screen">
      <Link to="/" className="back-link">
        ← Home Workouts
      </Link>
      <h1 className="screen-title">Settings</h1>

      <div className="kind-picker settings-tabs">
        <button
          type="button"
          className={`kind-picker-btn${tab === "equipment" ? " selected" : ""}`}
          onClick={() => setTab("equipment")}
        >
          Equipment
        </button>
        <button
          type="button"
          className={`kind-picker-btn${tab === "general" ? " selected" : ""}`}
          onClick={() => setTab("general")}
        >
          General
        </button>
      </div>

      {tab === "equipment" ? (
        <EquipmentSection />
      ) : (
        <div className="detail-field">
          <div className="slider-label">Your Name</div>
          <div className="detail-hint">Used for the Home Screen greeting.</div>
          <input
            type="text"
            className="detail-input"
            value={profile.name}
            onChange={(e) => setProfileName(e.target.value)}
            placeholder="Your name"
          />
        </div>
      )}
    </div>
  );
}
