import type { SeriesSummary } from "../lib/progress";

const WIDTH = 96;
const HEIGHT = 34;
const PAD = 4;

function dayTime(date: string): number {
  return new Date(`${date}T12:00:00`).getTime();
}

function seriesClass(side: SeriesSummary["side"]): string {
  if (side === "left") return "chart-series-left";
  if (side === "right") return "chart-series-right";
  return "chart-series-default";
}

/** A tiny weight-over-time line, no axes or labels — the trend's shape at a
 * glance. Every series in a row shares one scale (so left and right stay
 * comparable), and a flat history draws a flat line through the middle rather
 * than collapsing. */
export default function Sparkline({ series }: { series: SeriesSummary[] }) {
  const all = series.flatMap((s) => s.points);
  const times = all.map((p) => dayTime(p.date));
  const weights = all.map((p) => p.weight);
  const xMin = Math.min(...times);
  const xMax = Math.max(...times);
  const yMin = Math.min(...weights);
  const yMax = Math.max(...weights);

  const x = (date: string) =>
    xMax === xMin ? WIDTH / 2 : PAD + ((dayTime(date) - xMin) / (xMax - xMin)) * (WIDTH - PAD * 2);
  const y = (weight: number) =>
    yMax === yMin ? HEIGHT / 2 : HEIGHT - PAD - ((weight - yMin) / (yMax - yMin)) * (HEIGHT - PAD * 2);

  return (
    <svg className="sparkline" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width={WIDTH} height={HEIGHT} aria-hidden="true">
      {series.map((s) => {
        const cls = seriesClass(s.side);
        const coords = s.points.map((p) => ({ x: x(p.date), y: y(p.weight) }));
        const end = coords[coords.length - 1];
        return (
          <g key={s.side ?? "combined"}>
            {coords.length > 1 && (
              <polyline
                points={coords.map((c) => `${c.x},${c.y}`).join(" ")}
                className={`chart-line ${cls}`}
                style={{ fill: "none" }}
              />
            )}
            <circle cx={end.x} cy={end.y} r={3} className={`chart-point ${cls}`} />
          </g>
        );
      })}
    </svg>
  );
}
