"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import styles from "@/app/page.module.css";
import {
  buildFrequencySweep,
  buildRComparisonCurves,
  qualityFactor,
  parallelQualityFactor,
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
  // Seeded with the current R at the moment this panel was created --
  // after that it's independent of the "Resistance R" field above.
  const [rList, setRList] = useState<number[]>(() => [R]);
  const [manualR, setManualR] = useState(R);

  const [xMode, setXMode] = useState<SweepMode>("auto");
  const [xStart, setXStart] = useState(10);
  const [xFinish, setXFinish] = useState(1_000_000);
  const [xNumPoints, setXNumPoints] = useState(500);
  const [yMode, setYMode] = useState<SweepMode>("auto");
  const [yMin, setYMin] = useState(0.1);
  const [yMax, setYMax] = useState(1000);

  const sweep = useMemo(
    () => buildFrequencySweep(f0, { mode: xMode, start: xStart, finish: xFinish, numPoints: xNumPoints }),
    [f0, xMode, xStart, xFinish, xNumPoints]
  );
  const curves = useMemo(
    () => buildRComparisonCurves(sweep.freqs, rList, L, C, circuitType),
    [sweep, rList, L, C, circuitType]
  );

  const isManualRAlreadyAdded = useMemo(
    () => rList.some((r) => Math.abs(r - manualR) < 1e-12),
    [rList, manualR]
  );

  // Tracks the LIVE "Resistance R" field above (unlike rList, which is only
  // seeded from R once at creation) -- so if you change R after this chart
  // already exists, one click adds that new current value instead of
  // having to retype it into the manual field below.
  const isCurrentRAlreadyAdded = useMemo(
    () => rList.some((r) => Math.abs(r - R) < 1e-12),
    [rList, R]
  );

  function addR(value: number) {
    setRList((prev) => {
      const alreadyAdded = prev.some((r) => Math.abs(r - value) < 1e-12);
      return alreadyAdded || !(value > 0) ? prev : [...prev, value];
    });
  }

  function removeR(i: number) {
    setRList((prev) => prev.filter((_, j) => j !== i));
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
            {rList.map((rVal, i) => (
              <div key={i} className={styles.rListRow}>
                <span>
                  R = {rVal.toPrecision(3)} Ω (Q ={" "}
                  {(circuitType === "series" ? qualityFactor(rVal, L, C) : parallelQualityFactor(rVal, L, C)).toFixed(2)}
                  )
                </span>
                <button className={styles.rListRemove} onClick={() => removeR(i)} aria-label="Remove">
                  ×
                </button>
              </div>
            ))}
          </div>
          <button className={styles.addButton} onClick={() => addR(R)} disabled={isCurrentRAlreadyAdded}>
            {isCurrentRAlreadyAdded
              ? `R = ${R.toPrecision(3)} Ω already added -- change R above to add another`
              : `+ Add current R (${R.toPrecision(3)} Ω)`}
          </button>
          <div className={styles.manualCompareRow}>
            <input
              className={styles.input}
              type="number"
              min={0}
              value={manualR}
              onChange={(e) => setManualR(Number(e.target.value))}
              aria-label={`Manual R value to compare (chart ${index + 1})`}
            />
            <button
              className={styles.addButton}
              onClick={() => addR(manualR)}
              disabled={isManualRAlreadyAdded || !(manualR > 0)}
            >
              + Add R = {manualR.toPrecision(3)} Ω
            </button>
          </div>

          {rList.length === 0 ? (
            <p className={styles.presetNote}>Add at least one R value above to see a curve.</p>
          ) : (
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
          )}

          <QualityFactorChart curves={curves} />

          {canRemove && (
            <button className={styles.rListRemove} onClick={onRemove} style={{ marginTop: "0.75rem" }}>
              Remove this chart
            </button>
          )}
        </div>
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
      </div>
    </div>
  );
}
