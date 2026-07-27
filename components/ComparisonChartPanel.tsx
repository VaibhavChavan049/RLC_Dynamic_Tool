"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import styles from "@/app/page.module.css";
import {
  buildFrequencySweep,
  buildRComparisonCurves,
  qualityFactor,
  parallelQualityFactor,
  bandwidth,
  type SweepMode,
  type CircuitType,
} from "@/lib/rlc";

const RComparisonChart = dynamic(() => import("@/components/RComparisonChart"), { ssr: false });
const AxisControls = dynamic(() => import("@/components/AxisControls"), { ssr: false });
const QualityFactorChart = dynamic(() => import("@/components/QualityFactorChart"), { ssr: false });

// A Chart.js axis with min >= max renders a corrupted chart rather than an
// error, so an invalid manual Y-range must never reach the chart -- fall
// back to auto-scaling (undefined min/max) until Min < Max again.
function effectiveYRange(mode: SweepMode, min: number, max: number): { yMin?: number; yMax?: number } {
  if (mode === "manual" && min < max) return { yMin: min, yMax: max };
  return { yMin: undefined, yMax: undefined };
}

interface Props {
  L: number;
  C: number;
  R: number;
  circuitType: CircuitType;
  f0: number;
  index: number;
  onRemove: () => void;
  canRemove: boolean;
}

/**
 * One independent Impedance/Admittance/Quality-Factor comparison board --
 * its own R list, its own frequency sweep, its own Y-range. "+ Add
 * comparison chart" in page.tsx creates more of these, each fully separate
 * from the others, so different R sets can be explored side by side.
 */
export default function ComparisonChartPanel({ L, C, R, circuitType, f0, index, onRemove, canRemove }: Props) {
  // pinnedRList holds only the EXTRA R values you've explicitly pinned for
  // comparison -- the live "Resistance R" field above is never stored here.
  // It's always shown as its own entry instead (see displayEntries below),
  // so whatever you currently have set as R shows up immediately, with no
  // stale snapshot from whenever this chart happened to be created.
  const [pinnedRList, setPinnedRList] = useState<number[]>([]);
  const [manualR, setManualR] = useState(R);
  // Keeps the manual-pin field's suggested starting value in sync with the
  // live R above (it's just a starting point to tweak before pinning, not
  // something the user is expected to have already typed into) -- adjusted
  // during render rather than in an effect, per React's own guidance for
  // "reset state when a prop changes" (react.dev/learn/you-might-not-need-an-effect).
  const [prevR, setPrevR] = useState(R);
  if (R !== prevR) {
    setPrevR(R);
    setManualR(R);
  }

  const [xMode, setXMode] = useState<SweepMode>("auto");
  const [xStart, setXStart] = useState(10);
  const [xFinish, setXFinish] = useState(1_000_000);
  const [xNumPoints, setXNumPoints] = useState(500);
  const [yMode, setYMode] = useState<SweepMode>("auto");
  const [yMin, setYMin] = useState(0.1);
  const [yMax, setYMax] = useState(1000);

  // The live current R always comes first; pinned values are appended
  // after it, skipping any pinned value that happens to equal the live R
  // right now (so it isn't shown twice).
  const displayEntries = useMemo(() => {
    const entries: { value: number; pinnedIndex: number | null }[] = [{ value: R, pinnedIndex: null }];
    pinnedRList.forEach((r, i) => {
      if (Math.abs(r - R) > 1e-12) entries.push({ value: r, pinnedIndex: i });
    });
    return entries;
  }, [R, pinnedRList]);

  const sweep = useMemo(
    () => buildFrequencySweep(f0, { mode: xMode, start: xStart, finish: xFinish, numPoints: xNumPoints }),
    [f0, xMode, xStart, xFinish, xNumPoints]
  );
  const curves = useMemo(
    () => buildRComparisonCurves(sweep.freqs, displayEntries.map((e) => e.value), L, C, circuitType),
    [sweep, displayEntries, L, C, circuitType]
  );

  // Checked against pinnedRList itself, NOT displayEntries -- pinning the
  // value that currently equals live R is exactly the "lock this in before
  // I change R" workflow (displayEntries just hides the redundant duplicate
  // row for as long as they happen to coincide; the pin persists and
  // reappears once R moves away from it).
  const isManualRAlreadyAdded = useMemo(
    () => pinnedRList.some((r) => Math.abs(r - manualR) < 1e-12),
    [pinnedRList, manualR]
  );

  function pinR(value: number) {
    setPinnedRList((prev) => {
      const alreadyAdded = prev.some((r) => Math.abs(r - value) < 1e-12);
      return alreadyAdded || !(value > 0) ? prev : [...prev, value];
    });
  }

  function removePinnedR(i: number) {
    setPinnedRList((prev) => prev.filter((_, j) => j !== i));
  }

  return (
    <div className={styles.chartPanel}>
      <div className={styles.chartPanelBody} style={{ alignItems: "stretch" }}>
        <div className={styles.chartCanvasWrap}>
          <div className={styles.chartPanelTitle}>
            Comparison chart #{index + 1} --{" "}
            {circuitType === "series"
              ? "Impedance |Z| dips to R at resonance, Admittance |Y| = 1/|Z| peaks there"
              : "Impedance |Z| PEAKS to R at resonance, Admittance |Y| = 1/|Z| dips there"}
          </div>

          <div className={styles.rList}>
            {displayEntries.map((entry, i) => (
              <div key={i} className={styles.rListRow}>
                <span>
                  R = {entry.value.toPrecision(3)} Ω (Q ={" "}
                  {(circuitType === "series"
                    ? qualityFactor(entry.value, L, C)
                    : parallelQualityFactor(entry.value, L, C)
                  ).toFixed(2)}
                  ){entry.pinnedIndex === null && " -- current"}
                </span>
                {entry.pinnedIndex !== null && (
                  <button
                    className={styles.rListRemove}
                    onClick={() => removePinnedR(entry.pinnedIndex as number)}
                    aria-label="Remove"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          <label className={styles.manualCompareLabel} htmlFor={`manual-r-${index}`}>
            Add another R value manually to compare
          </label>
          <div className={styles.manualCompareRow}>
            <input
              id={`manual-r-${index}`}
              className={styles.input}
              type="number"
              min={0}
              value={manualR}
              onChange={(e) => setManualR(Number(e.target.value))}
            />
            <button
              className={styles.addButton}
              onClick={() => pinR(manualR)}
              disabled={isManualRAlreadyAdded || !(manualR > 0)}
            >
              + Pin R = {manualR.toPrecision(3)} Ω for comparison
            </button>
          </div>

          <RComparisonChart
            freqs={sweep.freqs}
            curves={curves}
            f0={f0}
            L={L}
            C={C}
            circuitType={circuitType}
            sweepParams={{ mode: xMode, start: xStart, finish: xFinish, numPoints: xNumPoints }}
            {...effectiveYRange(yMode, yMin, yMax)}
          />

          <QualityFactorChart curves={curves} f0={f0} />

          {canRemove && (
            <button className={styles.rListRemove} onClick={onRemove} style={{ marginTop: "0.75rem" }}>
              Remove this chart
            </button>
          )}
        </div>
        <div className={styles.rightColumn}>
          <AxisControls
            xMode={xMode}
            onXModeChange={setXMode}
            xStart={xStart}
            onXStartChange={setXStart}
            xFinish={xFinish}
            onXFinishChange={setXFinish}
            xNumPoints={xNumPoints}
            onXNumPointsChange={setXNumPoints}
            computedDelta={sweep.delta}
            downsampled={sweep.downsampled}
            invalidParams={sweep.invalidParams}
            pointCount={sweep.freqs.length}
            yMode={yMode}
            onYModeChange={setYMode}
            yMin={yMin}
            onYMinChange={setYMin}
            yMax={yMax}
            onYMaxChange={setYMax}
          />
          <div className={styles.rqbwTable}>
            <div className={styles.panelTitle}>R / Q / Bandwidth</div>
            <table>
              <thead>
                <tr>
                  <th>R (Ω)</th>
                  <th>Q</th>
                  <th>BW (Hz)</th>
                </tr>
              </thead>
              <tbody>
                {displayEntries.map((entry, i) => {
                  const q =
                    circuitType === "series"
                      ? qualityFactor(entry.value, L, C)
                      : parallelQualityFactor(entry.value, L, C);
                  const bw = bandwidth(f0, q);
                  return (
                    <tr key={i}>
                      <td>
                        {entry.value.toPrecision(3)}
                        {entry.pinnedIndex === null ? " (current)" : ""}
                      </td>
                      <td>{q.toFixed(2)}</td>
                      <td>{bw.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
