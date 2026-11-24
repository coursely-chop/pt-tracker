import type { ExerciseIconDef } from "../lib/exerciseIcons";

/** A single exercise icon, drawn in the surrounding text color unless a
 * class overrides it. Decorative (the exercise's name is always next to it),
 * so hidden from screen readers. */
export default function ExerciseIcon({ icon, size = 22, className }: { icon: ExerciseIconDef; size?: number; className?: string }) {
  return (
    <svg
      className={`exercise-icon${className ? ` ${className}` : ""}`}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d={icon.path} />
    </svg>
  );
}
