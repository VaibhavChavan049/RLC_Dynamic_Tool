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

/** Scale option: afterBuildTicks -- replaces the auto-generated ticks with
 * every 1x-9x value across each visible decade. */
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
  scale.ticks = ticks;
}

/** Ticks option: callback -- only label the major (power-of-10) ticks. */
export function logMajorOnlyLabel(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (!isPowerOfTen(num)) return "";
  return num.toLocaleString();
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
