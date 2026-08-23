import type { HistoryPoint } from "../lib/history";

const WIDTH = 320;
const HEIGHT = 220;
const PADDING = 32;

function scale(value: number, domainMin: number, domainMax: number, rangeMin: number, rangeMax: number): number {
  if (domainMax === domainMin) return (rangeMin + rangeMax) / 2;
  return rangeMin + ((value - domainMin) / (domainMax - domainMin)) * (rangeMax - rangeMin);
}

function seriesClass(side: HistoryPoint["side"]): string {
  if (side === "left") return "chart-series-left";
  if (side === "right") return "chart-series-right";
  return "chart-series-default";
}

/** Connected scatter: weight on X, reps on Y, points joined chronologically
 * within each side so the trajectory (not just a cloud of dots) is visible. */
export default function HistoryChart({ points }: { points: HistoryPoint[] }) {
  const weights = points.map((p) => p.weight);
  const reps = points.map((p) => p.reps);
  const weightSpan = Math.max(...weights) - Math.min(...weights);
  const repsSpan = Math.max(...reps) - Math.min(...reps);
  const weightPad = weightSpan > 0 ? weightSpan * 0.15 : 1;
  const repsPad = repsSpan > 0 ? repsSpan * 0.15 : 1;

  const xMin = Math.min(...weights) - weightPad;
  const xMax = Math.max(...weights) + weightPad;
  const yMin = Math.min(...reps) - repsPad;
  const yMax = Math.max(...reps) + repsPad;

  function toXY(p: HistoryPoint) {
    return {
      x: scale(p.weight, xMin, xMax, PADDING, WIDTH - PADDING),
      y: scale(p.reps, yMin, yMax, HEIGHT - PADDING, PADDING), // inverted: higher reps sits higher on screen
    };
  }

  const sideKeys = Array.from(new Set(points.map((p) => p.side ?? "combined")));

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="history-chart" role="img" aria-label="Weight versus reps history">
      <line x1={PADDING} y1={HEIGHT - PADDING} x2={WIDTH - PADDING} y2={HEIGHT - PADDING} className="chart-axis" />
      <line x1={PADDING} y1={PADDING} x2={PADDING} y2={HEIGHT - PADDING} className="chart-axis" />

      <text x={WIDTH / 2} y={HEIGHT - 6} className="chart-axis-label" textAnchor="middle">
        Weight (lbs)
      </text>
      <text
        x={10}
        y={HEIGHT / 2}
        className="chart-axis-label"
        textAnchor="middle"
        transform={`rotate(-90 10 ${HEIGHT / 2})`}
      >
        Reps
      </text>

      <text x={PADDING} y={HEIGHT - PADDING + 14} className="chart-tick" textAnchor="start">
        {Math.round(Math.min(...weights))}
      </text>
      <text x={WIDTH - PADDING} y={HEIGHT - PADDING + 14} className="chart-tick" textAnchor="end">
        {Math.round(Math.max(...weights))}
      </text>
      <text x={PADDING - 6} y={HEIGHT - PADDING} className="chart-tick" textAnchor="end">
        {Math.round(Math.min(...reps))}
      </text>
      <text x={PADDING - 6} y={PADDING} className="chart-tick" textAnchor="end">
        {Math.round(Math.max(...reps))}
      </text>

      {sideKeys.map((sideKey) => {
        const sidePoints = points
          .filter((p) => (p.side ?? "combined") === sideKey)
          .sort((a, b) => a.date.localeCompare(b.date));
        const coords = sidePoints.map(toXY);
        const cls = seriesClass(sideKey === "combined" ? undefined : (sideKey as HistoryPoint["side"]));

        return (
          <g key={sideKey}>
            {coords.length > 1 && (
              <polyline
                points={coords.map((c) => `${c.x},${c.y}`).join(" ")}
                className={`chart-line ${cls}`}
                style={{ fill: "none" }}
              />
            )}
            {sidePoints.map((p, i) => (
              <circle key={p.date + i} cx={coords[i].x} cy={coords[i].y} r={5} className={`chart-point ${cls}`}>
                <title>{`${p.date}: ${p.weight} lbs @ ${p.reps} reps`}</title>
              </circle>
            ))}
          </g>
        );
      })}
    </svg>
  );
}
