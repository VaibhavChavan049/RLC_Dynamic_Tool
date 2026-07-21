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
} from "@/lib/rlc";

// Chart.js touches the DOM/canvas, so it must only run in the browser --
// load it client-side only and skip server-side rendering for it.
const RlcChart = dynamic(() => import("@/components/RlcChart"), { ssr: false });

type Mode = "manual" | "preset";

export default function Home() {
  const [mode, setMode] = useState<Mode>("manual");

  const [lValue, setLValue] = useState(1);
  const [lUnit, setLUnit] = useState("mH (millihenry)");
  const [cValue, setCValue] = useState(10);
  const [cUnit, setCUnit] = useState("µF (microfarad)");
  const [rValue, setRValue] = useState(1);
  const [rUnit, setRUnit] = useState("Ω (Ohm)");

  const [presetIndex, setPresetIndex] = useState(0);

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

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>Series RLC Tank -- Resonant Frequency Calculator</h1>
          <p>Enter L, C, R in any unit -- or load an Excel-verified preset -- and see the Xc/XL crossing chart update instantly.</p>
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
              <button
                className={mode === "preset" ? styles.active : undefined}
                onClick={() => setMode("preset")}
              >
                Load a preset
              </button>
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
            <div className={styles.metrics}>
              <div className={styles.metricCard}>
                <div className={styles.metricLabel}>Resonant frequency f0</div>
                <div className={styles.metricValue}>{sweep.f0.toLocaleString(undefined, { maximumFractionDigits: 4 })} Hz</div>
              </div>
              <div className={styles.metricCard}>
                <div className={styles.metricLabel}>Characteristic impedance Zo</div>
                <div className={styles.metricValue}>{Zo.toLocaleString(undefined, { maximumFractionDigits: 4 })} Ω</div>
              </div>
              <div className={styles.metricCard}>
                <div className={styles.metricLabel}>L, C, R (SI units)</div>
                <div className={styles.metricValue} style={{ fontSize: "1rem" }}>
                  {L.toPrecision(3)} H, {C.toPrecision(3)} F, {R.toPrecision(3)} Ω
                </div>
              </div>
            </div>

            <div className={styles.chartPanel}>
              <RlcChart sweep={sweep} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
