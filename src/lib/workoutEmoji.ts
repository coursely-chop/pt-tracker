export interface EmojiGroup {
  label: string;
  emoji: string[];
}

/** Emoji offered when picking a workout's marker, grouped so a longer list
 * stays scannable. Colored circles and squares are in on purpose — the point
 * is telling workouts apart at a glance, and a color does that as well as a
 * picture. Deliberately leaves out 💪, which the Home Screen already uses as
 * the "done today" badge. Any other emoji can still be typed in. */
export const WORKOUT_EMOJI_GROUPS: EmojiGroup[] = [
  {
    label: "Activity",
    emoji: ["🏋️", "🏃", "🚴", "🧘", "🤸", "🥾", "🏊", "🥊", "🤼", "🧗", "🏄", "🚣", "🤾", "⛹️", "🏌️", "🥋", "🎿", "🏂", "🏓", "🏸", "⚽", "🏀", "🎾", "🏈"],
  },
  {
    label: "Body",
    emoji: ["🦵", "🦶", "🍑", "🫀", "🫁", "🧠", "🦴", "🦾", "🦿", "✊", "👊", "🖐️", "👣", "👀"],
  },
  {
    label: "Colors",
    emoji: ["🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "⚫", "⚪", "🟥", "🟧", "🟨", "🟩", "🟦", "🟪", "⬛", "⬜"],
  },
  {
    label: "Energy",
    emoji: ["🔥", "⚡", "💥", "🎯", "🚀", "⏱️", "⏰", "🌅", "☀️", "🌙", "⭐", "🌈", "❄️", "💧", "🌊", "🌪️"],
  },
  {
    label: "Animals",
    emoji: ["🦍", "🐻", "🦁", "🐢", "🐇", "🐺", "🦅", "🐎", "🐅", "🐆", "🦈", "🐘", "🦏", "🐂", "🦌", "🐝"],
  },
  {
    label: "Nature & food",
    emoji: ["🌲", "🍀", "🌵", "🌴", "🌻", "🪨", "🍎", "🍌", "🥑", "🥩", "🥚", "☕", "🍕", "🌶️"],
  },
  {
    label: "Things",
    emoji: ["🏠", "🏢", "🧱", "🛠️", "🔧", "⚙️", "🏆", "🥇", "🎧", "🎵", "📈", "🔑", "🧲", "💎", "🛡️", "⚔️"],
  },
];

// One emoji "character": a pictograph plus any variation selector, skin tone,
// or joined pictographs (so 🏋️ and 🧑‍🤝‍🧑 each count as one, not several).
const EMOJI_PATTERN = /\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier}|‍\p{Extended_Pictographic})*/u;

/** The first emoji in whatever was typed or pasted, or "" if there isn't one
 * — so the custom field can't end up holding letters or a whole sentence. */
export function firstEmoji(text: string): string {
  return text.match(EMOJI_PATTERN)?.[0] ?? "";
}
