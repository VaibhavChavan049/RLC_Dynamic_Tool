"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import styles from "./page.module.css";
import {
  L_UNITS,
  C_UNITS,
  R_UNITS,
  PRESETS,
  reactanceSweep,
  characteristicImpedance,
  angularResonantFreq,
  qualityFactor,
  admittanceQSweep,
} from "@/lib/rlc";

// Chart.js touches the DOM/canvas, so it must only run in the browser.
// Load it client-side only and skip server-side rendering for it.
const RlcChart = dynamic(() => import("@/components/RlcChart"), { ssr: false });
const QChart = dynamic(() => import("@/components/QChart"), { ssr: false });

type Mode = "manual" | "preset";

// Resonant frequency result unit: display label -> multiplier applied to
// the value in Hz (e.g. 1 kHz shown = f0 in Hz * 1e-3).
const F0_UNITS: Record<string, number> = {
  Hz: 1,
  kHz: 1e-3,
  MHz: 1e-6,
};

export default function Home() {
  const [mode, setMode] = useState<Mode>("manual");

  const [lValue, setLValue] = useState(1);
  const [lUnit, setLUnit] = useState("mH (millihenry)");
  const [cValue, setCValue] = useState(10);
  const [cUnit, setCUnit] = useState("µF (microfarad)");
  const [rValue, setRValue] = useState(1);
  const [rUnit, setRUnit] = useState("Ω (Ohm)");

  const [presetIndex, setPresetIndex] = useState(0);
  const [f0Unit, setF0Unit] = useState("Hz");
  const [logY, setLogY] = useState(false);

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

  const sweep = useMemo(() => reactanceSweep(L, C), [L, C]);
  const Zo = useMemo(() => characteristicImpedance(L, C), [L, C]);
  const w0 = useMemo(() => angularResonantFreq(L, C), [L, C]);
  const Q = useMemo(() => qualityFactor(R, L, C), [R, L, C]);
  const qSweep = useMemo(() => admittanceQSweep(R, L, C), [R, L, C]);

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
          <h1>Series RLC Tank: Resonant Frequency Calculator</h1>
          <p>Enter L, C, R in any unit and see the Xc/XL crossing chart update instantly.</p>
        </div>

        <div className={styles.layout}>
          <div className={styles.panel}>
            <div className={styles.panelTitle}>Circuit values</div>

            <div className={styles.modeToggle}>
              <button
                className={mode === "manual" ? styles.active : undefined}
                onClick={() => setMode("manual")}
              >
                Enter my own values
              </button>
              {/* Preset picker disabled for now, re-enable by uncommenting this button.
              <button
                className={mode === "preset" ? styles.active : undefined}
                onClick={() => setMode("preset")}
              >
                Load a preset
              </button>
              */}
            </div>

            {mode === "manual" ? (
              <>
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
          </div>

          <div className={styles.main}>
            <details className={styles.formulasBox}>
              <summary>Formulas used</summary>
              <div className={styles.formulasList}>
                <div className={styles.formulaRow}>
                  <span className={styles.formulaName}>Capacitive reactance Xc</span>
                  <span className={styles.formulaExpr}>Xc = 1 / (2π·f·C)</span>
                </div>
                <div className={styles.formulaRow}>
                  <span className={styles.formulaName}>Inductive reactance XL</span>
                  <span className={styles.formulaExpr}>XL = 2π·f·L</span>
                </div>
                <div className={styles.formulaRow}>
                  <span className={styles.formulaName}>Resonant frequency f0</span>
                  <span className={styles.formulaExpr}>f0 = 1 / (2π·√(L·C))</span>
                </div>
                <div className={styles.formulaRow}>
                  <span className={styles.formulaName}>Angular resonant frequency w0</span>
                  <span className={styles.formulaExpr}>w0 = 1 / √(L·C) = 2π·f0</span>
                </div>
                <div className={styles.formulaRow}>
                  <span className={styles.formulaName}>Characteristic impedance Zo</span>
                  <span className={styles.formulaExpr}>Zo = √(L / C)</span>
                </div>
                <div className={styles.formulaRow}>
                  <span className={styles.formulaName}>Quality factor Q</span>
                  <span className={styles.formulaExpr}>Q = (1 / R)·√(L / C)</span>
                </div>
                <div className={styles.formulaRow}>
                  <span className={styles.formulaName}>Impedance magnitude |Z|</span>
                  <span className={styles.formulaExpr}>|Z| = √(R² + (XL − Xc)²)</span>
                </div>
                <div className={styles.formulaRow}>
                  <span className={styles.formulaName}>Admittance magnitude |Y|</span>
                  <span className={styles.formulaExpr}>|Y| = 1 / |Z|</span>
                </div>
              </div>
            </details>

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
                  {(sweep.f0 * F0_UNITS[f0Unit]).toLocaleString(undefined, { maximumFractionDigits: 4 })} {f0Unit}
                </div>
              </div>
              <div className={styles.metricCard}>
                <div className={styles.metricLabel}>Characteristic impedance Zo</div>
                <div className={styles.metricValue}>{Zo.toLocaleString(undefined, { maximumFractionDigits: 4 })} Ω</div>
              </div>
              <div className={styles.metricCard}>
                <div className={styles.metricLabel}>Angular resonant frequency w0</div>
                <div className={styles.metricValue}>{w0.toLocaleString(undefined, { maximumFractionDigits: 4 })} rad/s</div>
              </div>
              <div className={styles.metricCard}>
                <div className={styles.metricLabel}>Quality factor Q</div>
                <div className={styles.metricValue}>{Q.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
              </div>
            </div>

            <div className={styles.chartPanel}>
              <label className={styles.checkboxRow}>
                <input type="checkbox" checked={logY} onChange={(e) => setLogY(e.target.checked)} />
                Log scale Y-axis (Impedance)
              </label>
              <RlcChart sweep={sweep} logY={logY} />
            </div>

            <div className={styles.chartPanel}>
              <div className={styles.chartPanelTitle}>
                Resonance peak vs quality factor (Q): lower R means higher Q and a sharper peak
              </div>
              <QChart sweep={qSweep} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
