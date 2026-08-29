import { BAND_HEX } from "../lib/equipment";
import type { SetLines as SetLinesData } from "../lib/format";

/** Small read-only color bars standing in for spelled-out band names ("Yellow
 * band") — this is the whole point of the bigger-type redesign: fewer words to
 * parse mid-set, glanceable instead of read. Sits on its own line below the
 * weight/reps rather than inline after them (an earlier inline version wrapped
 * unpredictably on the narrow Workout Overview panel once a combo got wide —
 * the wrap point landed differently depending on the row's own text length,
 * which read as broken rather than intentional). Rendered as one flat
 * horizontal row, not stacked into columns — with its own line, even 5 bars
 * (the most any exercise could ever have) comfortably fits the narrowest
 * panel width, so the column-balancing this used to need is gone. */
function BandDots({ colors }: { colors: string[] }) {
  if (colors.length === 0) return null;
  return (
    <div className="band-dots">
      {colors.map((color, i) => (
        <span key={i} className="band-dot" style={{ backgroundColor: BAND_HEX[color] }} aria-hidden="true" />
      ))}
    </div>
  );
}

/** e.g. "Working (x2)" / "Warmup (x1)" — the set count now lives in the label,
 * not buried inside the value line. */
export function SetLinesLabel({ label, sets }: { label: string; sets: number }) {
  return (
    <>
      {label} <span className="set-lines-sets">(x{sets})</span>
    </>
  );
}

export function SetLinesRows({ lines }: { lines: SetLinesData }) {
  return (
    <div className="set-lines-rows">
      {lines.rows.map((row, i) => (
        <div key={i} className="set-line-group">
          <div className="set-line-row">
            {row.sideLabel && <span className="set-line-side">{row.sideLabel}: </span>}
            <span className="set-line-text">{row.text}</span>
            <span className="set-line-reps"> x {row.reps}</span>
          </div>
          <BandDots colors={row.bandColors} />
        </div>
      ))}
    </div>
  );
}
