"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import styles from "@/app/page.module.css";
import {
  L_UNITS,
  C_UNITS,
  R_UNITS,
  PRESETS,
  characteristicImpedance,
  angularResonantFreq,
  qualityFactor,
  parallelQualityFactor,
  bandwidth,
  resonantFreq,
  buildFrequencySweep,
  reactanceAtFreqs,
  type SweepMode,
  type CircuitType,
} from "@/lib/rlc";
import type { TooltipReadout as TooltipReadoutData } from "@/lib/chartTooltip";
import TooltipReadout from "@/components/TooltipReadout";
import { FrequencyIcon, ImpedanceIcon, AngularFrequencyIcon, QualityFactorIcon, BandwidthIcon } from "@/components/MetricIcons";
import LogSlider from "@/components/LogSlider";

// Chart.js touches the DOM/canvas, so it must only run in the browser.
// Load it client-side only and skip server-side rendering for it.
const RlcChart = dynamic(() => import("@/components/RlcChart"), { ssr: false });
const AxisControls = dynamic(() => import("@/components/AxisControls"), { ssr: false });
const ComparisonChartPanel = dynamic(() => import("@/components/ComparisonChartPanel"), { ssr: false });

type Mode = "manual" | "preset";

interface HistorySnapshot {
  id: string;
  savedAt: string;
  lValue: number;
  lUnit: string;
  cValue: number;
  cUnit: string;
  rValue: number;
  rUnit: string;
  circuitType: CircuitType;
}

const HISTORY_STORAGE_KEY = "rlc_history";

function loadHistoryFromStorage(): HistorySnapshot[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as HistorySnapshot[]) : [];
  } catch {
    return [];
  }
}

function saveHistoryToStorage(list: HistorySnapshot[]) {
  try {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Storage full or unavailable (e.g. private browsing) -- history just
    // won't persist across reloads, not worth surfacing as an error.
  }
}

// A tiny external store for the history list, read via useSyncExternalStore
// (same pattern PasswordGate.tsx uses for sessionStorage) -- this avoids the
// "empty on server, populated on client" hydration mismatch that a plain
// useState+useEffect would cause, since localStorage doesn't exist during
// server-side rendering.
let historyCache: HistorySnapshot[] | null = null;
let historyListeners: (() => void)[] = [];

function getHistorySnapshot(): HistorySnapshot[] {
  if (historyCache === null) historyCache = loadHistoryFromStorage();
  return historyCache;
}

function getServerHistorySnapshot(): HistorySnapshot[] {
  return [];
}

function subscribeHistory(callback: () => void) {
  historyListeners.push(callback);
  return () => {
    historyListeners = historyListeners.filter((l) => l !== callback);
  };
}

function setHistoryStore(next: HistorySnapshot[]) {
  historyCache = next;
  saveHistoryToStorage(next);
  historyListeners.forEach((l) => l());
}

function formatSnapshotLabel(snap: HistorySnapshot): string {
  const lUnitShort = snap.lUnit.split(" ")[0];
  const cUnitShort = snap.cUnit.split(" ")[0];
  const rUnitShort = snap.rUnit.split(" ")[0];
  const circuit = snap.circuitType === "series" ? "Series" : "Parallel";
  return `L=${snap.lValue}${lUnitShort}, C=${snap.cValue}${cUnitShort}, R=${snap.rValue}${rUnitShort} (${circuit})`;
}

// Resonant frequency result unit: display label -> multiplier applied to
// the value in Hz (e.g. 1 kHz shown = f0 in Hz * 1e-3).
const F0_UNITS: Record<string, number> = {
  Hz: 1,
  kHz: 1e-3,
  MHz: 1e-6,
};

// Angular resonant frequency result unit: display label -> multiplier
// applied to the value in rad/s. "Hz" here means "converted to Hz",
// i.e. divided by 2*pi -- same number the f0 card shows in Hz.
const W0_UNITS: Record<string, number> = {
  "rad/s": 1,
  Hz: 1 / (2 * Math.PI),
};

// Formulas box content: Xc/XL/w0/f0/Zo are the same physics regardless of
// topology (they depend only on L and C), but Q and the impedance/admittance
// formulas differ -- series adds impedances directly, parallel adds
// admittances instead (see lib/rlc.ts for the derivations).
const SERIES_FORMULAS: [string, string][] = [
  ["Capacitive reactance Xc", "Xc = 1 / (2π·f·C)"],
  ["Inductive reactance XL", "XL = 2π·f·L"],
  ["Angular resonant frequency w0", "w0 = 1 / √(L·C)"],
  ["Resonant frequency f0", "f0 = w0 / (2π)"],
  ["Characteristic impedance Zo", "Zo = √(L / C)"],
  ["Quality factor Q", "Q = (1 / R)·√(L / C) = Zo / R"],
  ["Bandwidth BW", "BW = R / (2π·L) = f0 / Q"],
  ["Impedance magnitude |Z|", "|Z| = √(R² + (XL − Xc)²)"],
  ["Admittance magnitude |Y|", "|Y| = 1 / |Z|"],
  ["Current magnitude |I|", "|I| = V / |Z| = V · |Y|"],
  ["Peak current Imax", "Imax = V / R (at resonance, |Z| = R)"],
];

const PARALLEL_FORMULAS: [string, string][] = [
  ["Capacitive reactance Xc", "Xc = 1 / (2π·f·C)"],
  ["Inductive reactance XL", "XL = 2π·f·L"],
  ["Angular resonant frequency w0", "w0 = 1 / √(L·C)"],
  ["Resonant frequency f0", "f0 = w0 / (2π)"],
  ["Characteristic impedance Zo", "Zo = √(L / C)"],
  ["Conductance G", "G = 1 / R"],
  ["Capacitive susceptance Bc", "Bc = 2π·f·C = 1 / Xc"],
  ["Inductive susceptance Bl", "Bl = 1 / (2π·f·L) = 1 / XL"],
  ["Quality factor Q", "Q = R·√(C / L) = R / Zo"],
  ["Bandwidth BW", "BW = 1 / (2π·R·C) = f0 / Q"],
  ["Admittance magnitude |Y|", "|Y| = √(G² + (Bc − Bl)²)"],
  ["Impedance magnitude |Z|", "|Z| = 1 / |Y|"],
  ["Current magnitude |I|", "|I| = V / |Z| = V · |Y|"],
  ["Peak current Imax", "Imax = V / R (at resonance, |Z| = R)"],
];

// A Chart.js axis with min >= max renders a corrupted chart rather than an
// error, so an invalid manual Y-range must never reach the chart -- fall
// back to auto-scaling (undefined min/max) until Min < Max again.
function effectiveYRange(mode: SweepMode, min: number, max: number): { yMin?: number; yMax?: number } {
  if (mode === "manual" && min < max) return { yMin: min, yMax: max };
  return { yMin: undefined, yMax: undefined };
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("manual");
  // Series (impedances add, |Z| dips to R at resonance) vs Parallel
  // (admittances add, |Z| PEAKS to R at resonance instead) -- switches the
  // Q formula, the Impedance/Admittance chart's math, and the formulas box.
  // Chart 1 (Xc/XL crossing) is untouched by this: XL=Xc at resonance is a
  // property of L and C alone, true for both topologies.
  const [circuitType, setCircuitType] = useState<CircuitType>("series");

  const [vValue, setVValue] = useState(10);
  const [lValue, setLValue] = useState(1);
  const [lUnit, setLUnit] = useState("mH (millihenry)");
  const [cValue, setCValue] = useState(10);
  const [cUnit, setCUnit] = useState("µF (microfarad)");
  const [rValue, setRValue] = useState(1);
  const [rUnit, setRUnit] = useState("Ω (Ohm)");

  const [presetIndex, setPresetIndex] = useState(0);
  const [f0Unit, setF0Unit] = useState("Hz");
  const [w0Unit, setW0Unit] = useState("rad/s");
  const [logY, setLogY] = useState(true);

  // Each chart gets its own independent X-axis (frequency sweep) and Y-axis
  // (display range) controls -- "auto" behaves as before (X: two decades
  // either side of f0; Y: auto-scaled). "manual" takes Start, Finish, and
  // Number of Points directly (matching the whiteboard's own worked
  // example: Start=10Hz, Finish=1,000,000Hz, Points=500); the step size
  // is derived, not entered.
  const [chart1XMode, setChart1XMode] = useState<SweepMode>("auto");
  const [chart1Start, setChart1Start] = useState(10);
  const [chart1Finish, setChart1Finish] = useState(1_000_000);
  const [chart1NumPoints, setChart1NumPoints] = useState(500);
  const [chart1YMode, setChart1YMode] = useState<SweepMode>("auto");
  const [chart1YMin, setChart1YMin] = useState(0.1);
  const [chart1YMax, setChart1YMax] = useState(1000);
  const [chart1Readout, setChart1Readout] = useState<TooltipReadoutData | null>(null);

  // Comparison charts (Impedance/Admittance/Quality Factor) -- "+ Add
  // comparison chart" below creates more of these, each one an independent
  // ComparisonChartPanel with its own R list, its own frequency sweep, and
  // its own Y-range, entirely separate from the others.
  const [chartIds, setChartIds] = useState<number[]>([0]);
  const nextChartId = useRef(1);

  function addComparisonChart() {
    setChartIds((prev) => [...prev, nextChartId.current++]);
  }

  function removeComparisonChart(id: number) {
    setChartIds((prev) => prev.filter((cid) => cid !== id));
  }

  // History: manual snapshots of the circuit values (L, C, R, circuit type)
  // so earlier inputs can be reloaded later. Saved to localStorage (not
  // just in-memory) so they survive a page refresh; read via
  // useSyncExternalStore, same pattern as PasswordGate.tsx's sessionStorage
  // read, so there's no "empty on server, populated on client" mismatch.
  const history = useSyncExternalStore(subscribeHistory, getHistorySnapshot, getServerHistorySnapshot);

  function saveToHistory() {
    const snapshot: HistorySnapshot = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      savedAt: new Date().toISOString(),
      lValue,
      lUnit,
      cValue,
      cUnit,
      rValue,
      rUnit,
      circuitType,
    };
    setHistoryStore([snapshot, ...history].slice(0, 50)); // cap so localStorage doesn't grow unbounded
  }

  function loadFromHistory(snap: HistorySnapshot) {
    setMode("manual");
    setLValue(snap.lValue);
    setLUnit(snap.lUnit);
    setCValue(snap.cValue);
    setCUnit(snap.cUnit);
    setRValue(snap.rValue);
    setRUnit(snap.rUnit);
    setCircuitType(snap.circuitType);
  }

  function removeFromHistory(id: string) {
    setHistoryStore(history.filter((s) => s.id !== id));
  }

  const { L, C, R, excelF0 } = useMemo(() => {
    if (mode === "preset") {
      const p = PRESETS[presetIndex];
      return { L: p.L, C: p.C, R: p.R, excelF0: p.excelF0 };
    }
    return {
      L: lValue * L_UNITS[lUnit],
      C: cValue * C_UNITS[cUnit],
      R: rValue * R_UNITS[rUnit],
      excelF0: undefined as number | undefined,
    };
  }, [mode, presetIndex, lValue, lUnit, cValue, cUnit, rValue, rUnit]);

  const f0 = useMemo(() => resonantFreq(L, C), [L, C]);

  const chart1Sweep = useMemo(
    () => buildFrequencySweep(f0, { mode: chart1XMode, start: chart1Start, finish: chart1Finish, numPoints: chart1NumPoints }),
    [f0, chart1XMode, chart1Start, chart1Finish, chart1NumPoints]
  );
  const reactance = useMemo(() => reactanceAtFreqs(chart1Sweep.freqs, L, C), [chart1Sweep, L, C]);

  const Zo = useMemo(() => characteristicImpedance(L, C), [L, C]);
  const w0 = useMemo(() => angularResonantFreq(L, C), [L, C]);
  const Q = useMemo(
    () => (circuitType === "series" ? qualityFactor(R, L, C) : parallelQualityFactor(R, L, C)),
    [circuitType, R, L, C]
  );
  const BW = useMemo(() => bandwidth(f0, Q), [f0, Q]);

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.brandRow}>
            <div className={styles.logoWrap}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/drf-logo.png" alt="DRF Engineering Services" className={styles.logo} />
            </div>
            <div className={styles.tagline}>DRF Engineering Services, LLC. Champions of Power</div>
          </div>
          <h1>{circuitType === "series" ? "Series" : "Parallel"} RLC Tank: Resonant Frequency Calculator</h1>
          <p>
            This interactive RLC Calculator makes it easy to analyze series and parallel resonant circuits by
            turning your component values into detailed performance graphs. Enter your inductor (L) and capacitor
            (C) to establish the resonant frequency (f0), dial in your resistor (R) to control bandwidth, and add
            voltage (V) to calculate power and current draw. The tool dynamically plots reactance (XL vs. XC),
            impedance (|Z|), admittance (|Y|), and current selectivity curves so you can visualize how Q-factor and
            bandwidth change. Whether you&apos;re building wireless charging pads or audio filters, aim for
            operational frequencies above 20 kHz to keep component whine out of the audible range.
          </p>
          <div className={styles.circuitTypeRow}>
            <span className={styles.circuitTypeLabel}>Circuit type</span>
            <div className={styles.modeToggle}>
              <button
                className={circuitType === "series" ? styles.active : undefined}
                onClick={() => setCircuitType("series")}
              >
                Series RLC
              </button>
              <button
                className={circuitType === "parallel" ? styles.active : undefined}
                onClick={() => setCircuitType("parallel")}
              >
                Parallel RLC
              </button>
            </div>
          </div>
        </div>

        <div className={styles.layout}>
          <div className={styles.panel}>
            <div className={styles.panelTitle}>Circuit values</div>

            {mode === "manual" ? (
              <>
                <div className={styles.field}>
                  <label htmlFor="v-value">Supply Voltage V</label>
                  <input
                    id="v-value"
                    className={styles.input}
                    type="number"
                    value={vValue}
                    min={0}
                    onChange={(e) => setVValue(Number(e.target.value))}
                  />
                  <LogSlider valueSI={vValue} min={0.1} max={1000} onChangeSI={setVValue} />
                </div>

                <div className={styles.field}>
                  <label htmlFor="l-value">Inductance L</label>
                  <div className={styles.valueUnitRow}>
                    <input
                      id="l-value"
                      className={styles.input}
                      type="number"
                      value={lValue}
                      min={0}
                      onChange={(e) => setLValue(Number(e.target.value))}
                    />
                    <select className={styles.select} value={lUnit} onChange={(e) => setLUnit(e.target.value)}>
                      {Object.keys(L_UNITS).map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                  <LogSlider
                    valueSI={lValue * L_UNITS[lUnit]}
                    min={1e-9}
                    max={10}
                    onChangeSI={(v) => setLValue(v / L_UNITS[lUnit])}
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="c-value">Capacitance C</label>
                  <div className={styles.valueUnitRow}>
                    <input
                      id="c-value"
                      className={styles.input}
                      type="number"
                      value={cValue}
                      min={0}
                      onChange={(e) => setCValue(Number(e.target.value))}
                    />
                    <select className={styles.select} value={cUnit} onChange={(e) => setCUnit(e.target.value)}>
                      {Object.keys(C_UNITS).map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                  <LogSlider
                    valueSI={cValue * C_UNITS[cUnit]}
                    min={1e-12}
                    max={1e-2}
                    onChangeSI={(v) => setCValue(v / C_UNITS[cUnit])}
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="r-value">Resistance R</label>
                  <div className={styles.valueUnitRow}>
                    <input
                      id="r-value"
                      className={styles.input}
                      type="number"
                      value={rValue}
                      min={0}
                      onChange={(e) => setRValue(Number(e.target.value))}
                    />
                    <select className={styles.select} value={rUnit} onChange={(e) => setRUnit(e.target.value)}>
                      {Object.keys(R_UNITS).map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                  <LogSlider
                    valueSI={rValue * R_UNITS[rUnit]}
                    min={1e-3}
                    max={1e6}
                    onChangeSI={(v) => setRValue(v / R_UNITS[rUnit])}
                  />
                </div>
              </>
            ) : (
              <>
                <div className={styles.field}>
                  <label htmlFor="preset">Preset</label>
                  <select
                    id="preset"
                    className={styles.select}
                    value={presetIndex}
                    onChange={(e) => setPresetIndex(Number(e.target.value))}
                  >
                    {PRESETS.map((p, i) => (
                      <option key={p.name} value={i}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <p className={styles.presetNote}>
                  Values pulled from &quot;Admittance Magnitude Series RLC-Hatco.xlsx&quot; so the computed f0 below can be checked
                  against a known-good reference number.
                </p>
                {excelF0 !== undefined && (
                  <div className={styles.excelBadge}>Excel reference f0 = {excelF0.toFixed(4)} Hz</div>
                )}
              </>
            )}

            <div className={styles.panelDivider} />
            <div className={styles.panelTitle}>History</div>
            <button className={styles.addButton} onClick={saveToHistory}>
              + Save current values to history
            </button>
            <div className={styles.rList}>
              {history.length === 0 && (
                <p className={styles.presetNote}>
                  No saved snapshots yet. Click above to save L/C/R and circuit type so you can reload them later.
                </p>
              )}
              {history.map((snap) => (
                <div key={snap.id} className={styles.rListRow}>
                  <button className={styles.historyLoadButton} onClick={() => loadFromHistory(snap)}>
                    <span>{formatSnapshotLabel(snap)}</span>
                    <span className={styles.historyTimestamp}>{new Date(snap.savedAt).toLocaleString()}</span>
                  </button>
                  <button
                    className={styles.rListRemove}
                    onClick={() => removeFromHistory(snap.id)}
                    aria-label="Remove from history"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className={styles.panelDivider} />
            <div className={styles.sidebarFormulasGroup}>
              <div className={styles.sidebarFormulasHeading}>Series RLC</div>
              {SERIES_FORMULAS.map(([name, expr]) => (
                <div className={styles.sidebarFormulaRow} key={`series-${name}`}>
                  <span className={styles.sidebarFormulaName}>{name}</span>
                  <span className={styles.sidebarFormulaExpr}>{expr}</span>
                </div>
              ))}
            </div>
            <div className={styles.sidebarFormulasGroup}>
              <div className={styles.sidebarFormulasHeading}>Parallel RLC</div>
              {PARALLEL_FORMULAS.map(([name, expr]) => (
                <div className={styles.sidebarFormulaRow} key={`parallel-${name}`}>
                  <span className={styles.sidebarFormulaName}>{name}</span>
                  <span className={styles.sidebarFormulaExpr}>{expr}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.main}>
            <div className={styles.metrics}>
              <div className={styles.metricCardHighlight}>
                <div className={styles.metricRow}>
                  <div className={styles.metricLabel}>Resonant frequency f0</div>
                  <select
                    className={styles.unitSelect}
                    value={f0Unit}
                    onChange={(e) => setF0Unit(e.target.value)}
                  >
                    {Object.keys(F0_UNITS).map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.metricValue}>
                  {(f0 * F0_UNITS[f0Unit]).toLocaleString(undefined, { maximumFractionDigits: 4 })} {f0Unit}
                </div>
                <div className={styles.metricIconRow}>
                  <div className={styles.metricIconWrap}>
                    <FrequencyIcon size={22} />
                  </div>
                </div>
              </div>
              <div className={styles.metricCard}>
                <div className={styles.metricLabel}>Characteristic impedance Zo</div>
                <div className={styles.metricValue}>{Zo.toLocaleString(undefined, { maximumFractionDigits: 4 })} Ω</div>
                <div className={styles.metricIconRow}>
                  <div className={styles.metricIconWrap}>
                    <ImpedanceIcon size={22} />
                  </div>
                </div>
              </div>
              <div className={styles.metricCard}>
                <div className={styles.metricRow}>
                  <div className={styles.metricLabel}>Angular resonant frequency w0</div>
                  <select
                    className={styles.unitSelect}
                    value={w0Unit}
                    onChange={(e) => setW0Unit(e.target.value)}
                  >
                    {Object.keys(W0_UNITS).map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.metricValue}>
                  {(w0 * W0_UNITS[w0Unit]).toLocaleString(undefined, { maximumFractionDigits: 4 })} {w0Unit}
                </div>
                <div className={styles.metricIconRow}>
                  <div className={styles.metricIconWrap}>
                    <AngularFrequencyIcon size={22} />
                  </div>
                </div>
              </div>
              <div className={styles.metricCardHighlight}>
                <div className={styles.metricLabel}>Quality factor Q</div>
                <div className={styles.metricValue}>{Q.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
                <div className={styles.metricIconRow}>
                  <div className={styles.metricIconWrap}>
                    <QualityFactorIcon size={22} />
                  </div>
                </div>
              </div>
              <div className={styles.metricCard}>
                <div className={styles.metricLabel}>Bandwidth BW</div>
                <div className={styles.metricValue}>{BW.toLocaleString(undefined, { maximumFractionDigits: 4 })} Hz</div>
                <div className={styles.metricIconRow}>
                  <div className={styles.metricIconWrap}>
                    <BandwidthIcon size={22} />
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.chartPanel}>
              <div className={styles.chartTitle}>Xc and XL Reactance vs Frequency</div>
              <label className={styles.checkboxRow}>
                <input type="checkbox" checked={logY} onChange={(e) => setLogY(e.target.checked)} />
                Log scale Y-axis (Impedance)
              </label>
              <div className={styles.chartPanelBody}>
                <div className={styles.chartCanvasWrap}>
                  <RlcChart
                    reactance={reactance}
                    f0={f0}
                    logY={logY}
                    L={L}
                    C={C}
                    sweepParams={{ mode: chart1XMode, start: chart1Start, finish: chart1Finish, numPoints: chart1NumPoints }}
                    onHoverChange={setChart1Readout}
                    {...effectiveYRange(chart1YMode, chart1YMin, chart1YMax)}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <TooltipReadout data={chart1Readout} placeholder="Hover the chart to see exact values" />
                <AxisControls
                  xMode={chart1XMode}
                  onXModeChange={setChart1XMode}
                  xStart={chart1Start}
                  onXStartChange={setChart1Start}
                  xFinish={chart1Finish}
                  onXFinishChange={setChart1Finish}
                  xNumPoints={chart1NumPoints}
                  onXNumPointsChange={setChart1NumPoints}
                  computedDelta={chart1Sweep.delta}
                  downsampled={chart1Sweep.downsampled}
                  invalidParams={chart1Sweep.invalidParams}
                  pointCount={chart1Sweep.freqs.length}
                  yMode={chart1YMode}
                  onYModeChange={setChart1YMode}
                  yMin={chart1YMin}
                  onYMinChange={setChart1YMin}
                  yMax={chart1YMax}
                  onYMaxChange={setChart1YMax}
                />
                </div>
              </div>
            </div>

            {chartIds.map((id, idx) => (
              <ComparisonChartPanel
                key={id}
                V={vValue}
                L={L}
                C={C}
                R={R}
                circuitType={circuitType}
                f0={f0}
                index={idx}
                onRemove={() => removeComparisonChart(id)}
                canRemove={chartIds.length > 1}
              />
            ))}
            <button className={styles.addButton} onClick={addComparisonChart}>
              + Add comparison chart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
