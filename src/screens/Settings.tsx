import { Link } from "react-router-dom";
import EquipmentSection, { BackupRestore } from "./EquipmentSection";
import { useData } from "../lib/DataContext";

/** One page, no tabs: there are only three things here (your name, whether
 * home equipment matters, backup), and the equipment lists stay hidden unless
 * you opt into them — so splitting them across tabs was more navigation than
 * content. */
export default function Settings() {
  const { profile, setProfileName } = useData();

  return (
    <div className="screen">
      <Link to="/" className="back-link">
        ← Workouts
      </Link>
      <h1 className="screen-title">Settings</h1>

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

      <EquipmentSection />

      <BackupRestore />
    </div>
  );
}
