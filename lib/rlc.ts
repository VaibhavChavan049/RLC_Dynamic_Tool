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

export interface ReactanceSweep {
  freqs: number[];
  xc: number[];
  xl: number[];
  f0: number;
}

/**
 * Sweep frequency from f0/100 to f0*100 (log-spaced, matching the log
 * x-axis) and compute Xc/XL at each point. Centering the sweep two decades
 * either side of f0 is what makes the resonant frequency land in the
 * middle of the chart every time.
 */
export function reactanceSweep(L: number, C: number, points = 200): ReactanceSweep {
  const f0 = resonantFreq(L, C);
  const logStart = Math.log10(f0 / 100);
  const logStop = Math.log10(f0 * 100);

  const freqs: number[] = new Array(points);
  const xc: number[] = new Array(points);
  const xl: number[] = new Array(points);

  for (let i = 0; i < points; i++) {
    const t = i / (points - 1);
    const f = Math.pow(10, logStart + t * (logStop - logStart));
    freqs[i] = f;
    xc[i] = 1 / (2 * Math.PI * f * C); // capacitive reactance, falls with frequency
    xl[i] = 2 * Math.PI * f * L; // inductive reactance, rises with frequency
  }

  return { freqs, xc, xl, f0 };
}

export interface QComparisonCurve {
  label: string;
  R: number;
  Q: number;
  admittance: number[];
}

export interface QComparisonSweep {
  freqs: number[];
  curves: QComparisonCurve[];
  f0: number;
}

/**
 * Sweep |Y(f)| = 1/|Z(f)| over the same frequency range as reactanceSweep,
 * for three R values around the entered one (half, current, double), so the
 * effect of Q on the resonance peak's sharpness can be compared directly.
 */
export function admittanceQSweep(R: number, L: number, C: number, points = 200): QComparisonSweep {
  const f0 = resonantFreq(L, C);
  const logStart = Math.log10(f0 / 100);
  const logStop = Math.log10(f0 * 100);

  const freqs: number[] = new Array(points);
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1);
    freqs[i] = Math.pow(10, logStart + t * (logStop - logStart));
  }

  const rValues = [
    { label: "Lower R (higher Q)", R: R / 2 },
    { label: "Current R", R },
    { label: "Higher R (lower Q)", R: R * 2 },
  ];

  const curves: QComparisonCurve[] = rValues.map(({ label, R: rVal }) => ({
    label,
    R: rVal,
    Q: qualityFactor(rVal, L, C),
    admittance: freqs.map((f) => admittanceMagnitude(f, rVal, L, C)),
  }));

  return { freqs, curves, f0 };
}
