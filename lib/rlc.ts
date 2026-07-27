// Core series-RLC math: reactance formulas, resonant frequency, unit tables,
// and Excel-backed presets. Pure functions with no React/DOM here, so the
// numbers can be unit-tested or reused outside the chart component.

export type UnitMap = Record<string, number>;

// Each entry: display label -> multiplier to convert into the SI base unit.
export const L_UNITS: UnitMap = {
  "H (Henry)": 1,
  "mH (millihenry)": 1e-3,
  "µH (microhenry)": 1e-6,
};

export const C_UNITS: UnitMap = {
  "F (Farad)": 1,
  "mF (millifarad)": 1e-3,
  "µF (microfarad)": 1e-6,
  "nF (nanofarad)": 1e-9,
  "pF (picofarad)": 1e-12,
};

export const R_UNITS: UnitMap = {
  "Ω (Ohm)": 1,
  "mΩ (milliohm)": 1e-3,
  "kΩ (kiloohm)": 1e3,
};

export interface Preset {
  name: string;
  L: number; // Henries
  C: number; // Farads
  R: number; // Ohms
  excelF0?: number; // reference resonant frequency from the Excel workbook, if known
}

// Values confirmed against "Admittance Magnitude Series RLC-Hatco .xlsx"
// (Sheet2 and Sheet3 "Hatco Unit"), plus the whiteboard sketch's own numbers.
export const PRESETS: Preset[] = [
  {
    name: "Whiteboard sketch defaults (L=1mH, C=10µF, R=1Ω)",
    L: 1e-3,
    C: 10e-6,
    R: 1.0,
  },
  {
    name: "Excel Sheet2 example (L=1.5mH, C=0.68µF, R=10Ω)",
    L: 1.5e-3,
    C: 6.8e-7,
    R: 10.0,
    excelF0: 4983.334571,
  },
  {
    name: "Excel Sheet3 'Hatco Unit' (L=0.1mH, C=0.7µF, R=11.95Ω)",
    L: 1e-4,
    C: 7e-7,
    R: 11.95229,
    excelF0: 19022.6541,
  },
];

/** w0 = 1/sqrt(L*C): angular resonant frequency in rad/s. */
export function angularResonantFreq(L: number, C: number): number {
  return 1 / Math.sqrt(L * C);
}

/** f0 = w0 / (2*pi): the frequency (in Hz) where XL = Xc. */
export function resonantFreq(L: number, C: number): number {
  return angularResonantFreq(L, C) / (2 * Math.PI);
}

/** Zo = sqrt(L/C): the reactance value both curves share at resonance. */
export function characteristicImpedance(L: number, C: number): number {
  return Math.sqrt(L / C);
}

/**
 * Q = (1/R) * sqrt(L/C): quality factor of a series RLC tank. Higher Q
 * (lower R) gives a sharper, narrower resonance peak; lower Q (higher R)
 * gives a wider one. Q and w0 are the two parameters of the standard
 * 2nd-order denominator s^2 + (w0/Q)*s + w0^2 that describes this circuit.
 */
export function qualityFactor(R: number, L: number, C: number): number {
  return (1 / R) * Math.sqrt(L / C);
}

/** |Z(f)| = sqrt(R^2 + (XL(f) - Xc(f))^2): series RLC impedance magnitude. */
export function impedanceMagnitude(f: number, R: number, L: number, C: number): number {
  const xl = 2 * Math.PI * f * L;
  const xc = 1 / (2 * Math.PI * f * C);
  return Math.sqrt(R * R + (xl - xc) * (xl - xc));
}

/**
 * |Y(f)| = 1/|Z(f)|: admittance magnitude. For a SERIES RLC circuit, |Z|
 * is at its minimum (= R) at resonance, so |Y| peaks there -- this is the
 * classic resonance peak, and its sharpness depends on Q.
 */
export function admittanceMagnitude(f: number, R: number, L: number, C: number): number {
  return 1 / impedanceMagnitude(f, R, L, C);
}

export type CircuitType = "series" | "parallel";

/**
 * Q for a PARALLEL RLC tank: Q = R * sqrt(C/L) = R / Zo. Note this is the
 * INVERSE relationship to series (qualityFactor above, Q = Zo/R): here a
 * HIGHER R gives a higher Q / sharper resonance, because R is now a shunt
 * path across the tank rather than a series bottleneck.
 */
export function parallelQualityFactor(R: number, L: number, C: number): number {
  return R * Math.sqrt(C / L);
}

/**
 * |Z(f)| for a PARALLEL RLC tank. Unlike series (impedances add directly),
 * parallel branches share the same voltage, so ADMITTANCES add instead:
 *   G  = 1/R                  -- conductance of the resistor branch
 *   Bc = 2*pi*f*C = 1/Xc       -- capacitive susceptance
 *   Bl = 1/(2*pi*f*L) = 1/XL   -- inductive susceptance
 *   |Y| = sqrt(G^2 + (Bc - Bl)^2),  |Z| = 1/|Y|
 * At resonance Bc = Bl, so |Y| is at its MINIMUM (= G), meaning |Z| PEAKS
 * to R -- the mirror image of the series circuit, which dips to R instead.
 */
export function parallelImpedanceMagnitude(f: number, R: number, L: number, C: number): number {
  const g = 1 / R;
  const bc = 2 * Math.PI * f * C;
  const bl = 1 / (2 * Math.PI * f * L);
  const y = Math.sqrt(g * g + (bc - bl) * (bc - bl));
  return 1 / y;
}

/** |Y(f)| for a parallel RLC tank: dips to 1/R at resonance (mirror of the series admittance peak). */
export function parallelAdmittanceMagnitude(f: number, R: number, L: number, C: number): number {
  return 1 / parallelImpedanceMagnitude(f, R, L, C);
}

export type SweepMode = "auto" | "manual";

export interface SweepParams {
  mode: SweepMode;
  start: number; // Hz, used only in "manual" mode
  finish: number; // Hz, used only in "manual" mode
  numPoints: number; // number of steps from start to finish, used only in
  // "manual" mode. The step size (delta) is derived from this:
  //   delta = (finish - start) / numPoints
  // matching the whiteboard's own worked example (Start=10, End=1,000,000,
  // Points=500 -> delta = (1,000,000 - 10) / 500).
}

// Keeps CHARTS smooth and the browser responsive -- this cap only limits
// what gets drawn on screen. Asking for millions of points on the chart
// itself would freeze it, so requests beyond this get evenly resampled
// across the same start/finish range for RENDERING purposes.
const MAX_SWEEP_POINTS = 2000;

// CSV export has no rendering-smoothness constraint (a browser can build
// and download a 100,000+ row text file without trouble), so it gets a
// much higher, independent cap -- a request for exactly 100,000 points
// should produce a CSV with exactly 100,001 rows (start through finish
// inclusive), not the same 2,000-row chart resampling. This ceiling exists
// only to guard against truly extreme input (e.g. typing a billion) that
// would otherwise hang the tab while building the export array.
const MAX_EXPORT_POINTS = 500_000;

export interface FrequencySweep {
  freqs: number[];
  delta: number; // the computed step size (Hz) between consecutive points
  downsampled: boolean; // numPoints was too high to render smoothly, resampled to MAX_SWEEP_POINTS
  invalidParams: boolean; // start/finish/numPoints don't make sense (e.g. finish <= start); fell back to auto
}

function autoSweep(f0: number): number[] {
  const points = 200;
  const logStart = Math.log10(f0 / 100);
  const logStop = Math.log10(f0 * 100);
  const freqs: number[] = new Array(points);
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1);
    freqs[i] = Math.pow(10, logStart + t * (logStop - logStart));
  }
  return freqs;
}

/** Shared by buildFrequencySweep (chart cap) and buildExportFrequencies
 * (CSV cap) -- same start/finish/numPoints math, different point ceiling. */
function generateManualFreqs(
  start: number,
  finish: number,
  numPoints: number,
  maxPoints: number
): { freqs: number[]; delta: number; downsampled: boolean } {
  const delta = (finish - start) / numPoints;
  const sampleCount = numPoints + 1; // numPoints steps -> numPoints+1 samples, start through finish

  if (sampleCount <= maxPoints) {
    const freqs: number[] = new Array(sampleCount);
    for (let i = 0; i < sampleCount; i++) freqs[i] = start + i * delta;
    return { freqs, delta, downsampled: false };
  }

  // Too many points requested for this ceiling -- keep the requested
  // start/finish range, but resample evenly to maxPoints.
  const freqs: number[] = new Array(maxPoints);
  for (let i = 0; i < maxPoints; i++) {
    const t = i / (maxPoints - 1);
    freqs[i] = start + t * (finish - start);
  }
  return { freqs, delta, downsampled: true };
}

/**
 * Build the frequency points shared by every chart on the page.
 *   "auto"   -- log-spaced, two decades either side of f0 (previous default
 *               behavior, centers the resonant frequency on the chart)
 *   "manual" -- Start, Finish, and Number of Points are entered directly;
 *               the step size is derived as (finish - start) / numPoints,
 *               producing numPoints + 1 samples from start to finish
 *               inclusive (matches the whiteboard's worked example)
 */
export function buildFrequencySweep(f0: number, params: SweepParams): FrequencySweep {
  if (params.mode === "manual") {
    const { start, finish, numPoints } = params;
    const validParams = start > 0 && finish > start && Number.isFinite(numPoints) && numPoints >= 1;

    if (!validParams) {
      // e.g. Finish <= Start, or Points < 1 -- these can't be swept, so fall
      // back to the auto sweep rather than silently producing an empty/
      // single-point chart. `invalidParams` lets the UI show why.
      return { freqs: autoSweep(f0), delta: 0, downsampled: false, invalidParams: true };
    }

    const { freqs, delta, downsampled } = generateManualFreqs(start, finish, numPoints, MAX_SWEEP_POINTS);
    return { freqs, delta, downsampled, invalidParams: false };
  }

  return { freqs: autoSweep(f0), delta: 0, downsampled: false, invalidParams: false };
}

/**
 * Full-resolution frequencies for CSV export -- independent of whatever the
 * chart itself downsampled to. "auto" mode has no user-requested count (it's
 * always the same 200 log-spaced points), so it matches the chart exactly;
 * "manual" mode regenerates at up to MAX_EXPORT_POINTS instead of the much
 * lower chart-rendering cap.
 */
export function buildExportFrequencies(f0: number, params: SweepParams): number[] {
  if (params.mode === "manual") {
    const { start, finish, numPoints } = params;
    const validParams = start > 0 && finish > start && Number.isFinite(numPoints) && numPoints >= 1;
    if (!validParams) return autoSweep(f0);
    return generateManualFreqs(start, finish, numPoints, MAX_EXPORT_POINTS).freqs;
  }
  return autoSweep(f0);
}

export interface ReactancePoints {
  freqs: number[];
  xc: number[];
  xl: number[];
}

/** Xc/XL at each frequency in `freqs`, for the Xc/XL crossing chart. */
export function reactanceAtFreqs(freqs: number[], L: number, C: number): ReactancePoints {
  const xc: number[] = new Array(freqs.length);
  const xl: number[] = new Array(freqs.length);
  for (let i = 0; i < freqs.length; i++) {
    const f = freqs[i];
    xc[i] = 1 / (2 * Math.PI * f * C); // capacitive reactance, falls with frequency
    xl[i] = 2 * Math.PI * f * L; // inductive reactance, rises with frequency
  }
  return { freqs, xc, xl };
}

export interface RComparisonCurve {
  R: number;
  Q: number;
  admittance: number[];
  impedance: number[];
}

/**
 * For each R value in `rList`, compute |Y(f)| and |Z(f)| across `freqs`,
 * using either the series or the parallel formula depending on
 * `circuitType` (they differ in both the impedance formula and the Q
 * formula -- see impedanceMagnitude/parallelImpedanceMagnitude above).
 * Feeds the Impedance/Admittance chart, so a manually-built list of R
 * values (e.g. R=1 Ω kept, then R=5 Ω added on top) shows up consistently.
 */
export function buildRComparisonCurves(
  freqs: number[],
  rList: number[],
  L: number,
  C: number,
  circuitType: CircuitType
): RComparisonCurve[] {
  return rList.map((R) => {
    const admittance: number[] = new Array(freqs.length);
    const impedance: number[] = new Array(freqs.length);
    for (let i = 0; i < freqs.length; i++) {
      const z =
        circuitType === "series"
          ? impedanceMagnitude(freqs[i], R, L, C)
          : parallelImpedanceMagnitude(freqs[i], R, L, C);
      impedance[i] = z;
      admittance[i] = 1 / z;
    }
    const Q = circuitType === "series" ? qualityFactor(R, L, C) : parallelQualityFactor(R, L, C);
    return { R, Q, admittance, impedance };
  });
}
