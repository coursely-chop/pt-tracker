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

function dayTime(date: string): number {
  return new Date(`${date}T12:00:00`).getTime();
}

function shortDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Weight over time: date on X, weight on Y, one line per side. An earlier
 * version plotted weight against reps — but progress here is almost always a
 * heavier weight at the same reps, which drew a flat horizontal line however
 * much you'd improved. Reps live in each point's label (tap/hover) and in the
 * "Latest" line under the chart instead. */
export default function HistoryChart({ points }: { points: HistoryPoint[] }) {
  const times = points.map((p) => dayTime(p.date));
  const weights = points.map((p) => p.weight);
  const weightSpan = Math.max(...weights) - Math.min(...weights);
  const weightPad = weightSpan > 0 ? weightSpan * 0.15 : 1;

  const xMin = Math.min(...times);
  const xMax = Math.max(...times);
  const yMin = Math.min(...weights) - weightPad;
  const yMax = Math.max(...weights) + weightPad;
  const sortedDates = points.map((p) => p.date).sort();

  function toXY(p: HistoryPoint) {
    return {
      x: scale(dayTime(p.date), xMin, xMax, PADDING, WIDTH - PADDING),
      y: scale(p.weight, yMin, yMax, HEIGHT - PADDING, PADDING),
    };
  }

  const sideKeys = Array.from(new Set(points.map((p) => p.side ?? "combined")));

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="history-chart" role="img" aria-label="Weight over time">
      <line x1={PADDING} y1={HEIGHT - PADDING} x2={WIDTH - PADDING} y2={HEIGHT - PADDING} className="chart-axis" />
      <line x1={PADDING} y1={PADDING} x2={PADDING} y2={HEIGHT - PADDING} className="chart-axis" />

      <text
        x={10}
        y={HEIGHT / 2}
        className="chart-axis-label"
        textAnchor="middle"
        transform={`rotate(-90 10 ${HEIGHT / 2})`}
      >
        Weight (lbs)
      </text>

      <text x={PADDING} y={HEIGHT - PADDING + 14} className="chart-tick" textAnchor="start">
        {shortDate(sortedDates[0])}
      </text>
      <text x={WIDTH - PADDING} y={HEIGHT - PADDING + 14} className="chart-tick" textAnchor="end">
        {shortDate(sortedDates[sortedDates.length - 1])}
      </text>
      <text x={PADDING - 6} y={HEIGHT - PADDING} className="chart-tick" textAnchor="end">
        {Math.round(Math.min(...weights))}
      </text>
      <text x={PADDING - 6} y={PADDING + 4} className="chart-tick" textAnchor="end">
        {Math.round(Math.max(...weights))}
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
