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

export type SweepMode = "auto" | "manual";

export interface SweepParams {
  mode: SweepMode;
  start: number; // Hz, used only in "manual" mode
  finish: number; // Hz, used only in "manual" mode
  delta: number; // Hz, used only in "manual" mode -- the step size, like
  // dialing "start/stop/increment" on an LCR meter's sweep
}

// Keeps charts smooth and the browser responsive. A very fine delta over a
// wide range (e.g. 1 Hz steps from 1 Hz to 1 MHz = a million points) would
// freeze the chart, so points beyond this get evenly resampled across the
// same start/finish range instead of literally stepping one-by-one.
const MAX_SWEEP_POINTS = 2000;

export interface FrequencySweep {
  freqs: number[];
  downsampled: boolean;
}

/**
 * Build the frequency points shared by every chart on the page.
 *   "auto"   -- log-spaced, two decades either side of f0 (previous default
 *               behavior, centers the resonant frequency on the chart)
 *   "manual" -- steps from `start` to `finish` in increments of `delta`,
 *               exactly like sweeping frequency on an LCR meter
 */
export function buildFrequencySweep(f0: number, params: SweepParams): FrequencySweep {
  if (params.mode === "manual" && params.start > 0 && params.finish > params.start && params.delta > 0) {
    const { start, finish, delta } = params;
    const rawCount = Math.floor((finish - start) / delta) + 1;

    if (rawCount <= MAX_SWEEP_POINTS) {
      const freqs: number[] = new Array(rawCount);
      for (let i = 0; i < rawCount; i++) freqs[i] = start + i * delta;
      return { freqs, downsampled: false };
    }

    // Delta is finer than we can render smoothly -- keep the requested
    // start/finish range, but resample evenly to MAX_SWEEP_POINTS.
    const freqs: number[] = new Array(MAX_SWEEP_POINTS);
    for (let i = 0; i < MAX_SWEEP_POINTS; i++) {
      const t = i / (MAX_SWEEP_POINTS - 1);
      freqs[i] = start + t * (finish - start);
    }
    return { freqs, downsampled: true };
  }

  const points = 200;
  const logStart = Math.log10(f0 / 100);
  const logStop = Math.log10(f0 * 100);
  const freqs: number[] = new Array(points);
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1);
    freqs[i] = Math.pow(10, logStart + t * (logStop - logStart));
  }
  return { freqs, downsampled: false };
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
 * For each R value in `rList`, compute |Y(f)| and |Z(f)| across `freqs`.
 * Feeds both the Admittance chart (peaks at resonance) and the Impedance
 * chart (dips at resonance, since |Z| = 1/|Y|) from the same underlying
 * data, so a manually-built list of R values (e.g. R=1 Ω kept, then R=5 Ω
 * added on top) shows up consistently on both.
 */
export function buildRComparisonCurves(freqs: number[], rList: number[], L: number, C: number): RComparisonCurve[] {
  return rList.map((R) => {
    const admittance: number[] = new Array(freqs.length);
    const impedance: number[] = new Array(freqs.length);
    for (let i = 0; i < freqs.length; i++) {
      const z = impedanceMagnitude(freqs[i], R, L, C);
      impedance[i] = z;
      admittance[i] = 1 / z;
    }
    return { R, Q: qualityFactor(R, L, C), admittance, impedance };
  });
}
