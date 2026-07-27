// Helpers that make a Chart.js logarithmic scale look like real log-log
// graph paper: a labeled major gridline at every power of 10 (1, 10, 100,
// ...) AND a visible minor gridline at every value in between (2, 3, 4,
// ... 9, then 20, 30, ... 90, etc.), regardless of how many decades are
// on screen. Chart.js's default logarithmic scale thins these out on its
// own, so the tick set is generated explicitly instead of left automatic
// (the same reason the matplotlib version of this chart needed a custom
// LogLocator instead of the default one).

import type { Scale, ScriptableScaleContext } from "chart.js";

function isPowerOfTen(value: number): boolean {
  const log = Math.log10(value);
  return Math.abs(log - Math.round(log)) < 1e-9;
}

// How close (in decades) a value can be to a power of ten before its own
// label would visually crowd/overlap that power-of-ten's label.
const BOUNDARY_LABEL_CLEARANCE_DECADES = 0.15;

function isNearPowerOfTen(value: number): boolean {
  const log = Math.log10(value);
  return Math.abs(log - Math.round(log)) < BOUNDARY_LABEL_CLEARANCE_DECADES;
}

/** Scale option: afterBuildTicks -- replaces the auto-generated ticks with
 * every 1x-9x value across each visible decade, PLUS the axis's exact
 * min/max themselves (e.g. a manually-typed Start/Finish like 234,567
 * won't land on a round 1x-9x grid value, so without this the boundary
 * would have no gridline/label at all -- easy to mistake for the chart
 * having silently clamped to the nearest round number instead of honoring
 * what was actually typed). */
export function buildLogGraphPaperTicks(scale: Scale): void {
  const min = scale.min as number;
  const max = scale.max as number;
  if (!(min > 0) || !(max > 0)) return;

  const minExp = Math.floor(Math.log10(min));
  const maxExp = Math.ceil(Math.log10(max));
  const ticks: { value: number }[] = [];

  for (let exp = minExp; exp <= maxExp; exp++) {
    for (let m = 1; m <= 9; m++) {
      const value = m * Math.pow(10, exp);
      if (value >= min * 0.999 && value <= max * 1.001) {
        ticks.push({ value });
      }
    }
  }
  if (!ticks.some((t) => Math.abs(t.value - min) < min * 1e-9)) ticks.push({ value: min });
  if (!ticks.some((t) => Math.abs(t.value - max) < max * 1e-9)) ticks.push({ value: max });
  ticks.sort((a, b) => a.value - b.value);
  scale.ticks = ticks;
}

/** Ticks option: callback -- labels the major (power-of-10) ticks, plus
 * the very first/last tick (the axis's actual boundary), so a
 * manually-entered Start/Finish that isn't a round number still gets a
 * visible confirmation label right at the edge of the chart -- unless that
 * boundary sits so close to a power-of-ten that its label would just
 * overlap the round number's label (e.g. an auto-scaled max of 12,566
 * sitting right next to the 10,000 gridline), in which case the
 * power-of-ten label alone is clearer. */
export function logMajorOnlyLabel(value: number | string, index: number, ticks: { value: number }[]): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isPowerOfTen(num)) return num.toLocaleString();
  const isBoundary = index === 0 || index === ticks.length - 1;
  if (isBoundary && !isNearPowerOfTen(num)) return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return "";
}

/** Grid option: color -- bolder line on majors, faint line on minors. */
export function logGridColor(ctx: ScriptableScaleContext, majorColor: string, minorColor: string): string {
  const value = ctx.tick?.value;
  if (value == null) return minorColor;
  return isPowerOfTen(value) ? majorColor : minorColor;
}

/** Grid option: lineWidth -- thicker line on majors, thinner on minors. */
export function logGridWidth(ctx: ScriptableScaleContext): number {
  const value = ctx.tick?.value;
  if (value == null) return 1;
  return isPowerOfTen(value) ? 1 : 0.5;
}
