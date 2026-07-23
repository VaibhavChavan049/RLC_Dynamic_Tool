"use client";

import styles from "./AxisControls.module.css";
import type { SweepMode } from "@/lib/rlc";

interface Props {
  xMode: SweepMode;
  onXModeChange: (mode: SweepMode) => void;
  xStart: number;
  onXStartChange: (value: number) => void;
  xFinish: number;
  onXFinishChange: (value: number) => void;
  xDelta: number;
  onXDeltaChange: (value: number) => void;
  downsampled: boolean;
  tooCoarse: boolean;
  invalidParams: boolean;
  pointCount: number;

  yMode: SweepMode;
  onYModeChange: (mode: SweepMode) => void;
  yMin: number;
  onYMinChange: (value: number) => void;
  yMax: number;
  onYMaxChange: (value: number) => void;
}

/**
 * Per-chart axis controls: X-axis (frequency) auto/manual with
 * start/finish/delta, and Y-axis auto/manual with min/max. Each chart on
 * the page gets its own instance of this with its own state, so the two
 * charts can be swept/scaled independently of each other.
 */
export default function AxisControls({
  xMode,
  onXModeChange,
  xStart,
  onXStartChange,
  xFinish,
  onXFinishChange,
  xDelta,
  onXDeltaChange,
  downsampled,
  tooCoarse,
  invalidParams,
  pointCount,
  yMode,
  onYModeChange,
  yMin,
  onYMinChange,
  yMax,
  onYMaxChange,
}: Props) {
  return (
    <div className={styles.controls}>
      <div className={styles.section}>
        <div className={styles.label}>X-axis (frequency)</div>
        <div className={styles.toggle}>
          <button className={xMode === "auto" ? styles.active : undefined} onClick={() => onXModeChange("auto")}>
            Auto
          </button>
          <button className={xMode === "manual" ? styles.active : undefined} onClick={() => onXModeChange("manual")}>
            Manual
          </button>
        </div>
        {xMode === "manual" && (
          <>
            <label className={styles.fieldLabel}>
              Start (Hz)
              <input
                className={styles.input}
                type="number"
                value={xStart}
                min={0}
                onChange={(e) => onXStartChange(Number(e.target.value))}
              />
            </label>
            <label className={styles.fieldLabel}>
              Finish (Hz)
              <input
                className={styles.input}
                type="number"
                value={xFinish}
                min={0}
                onChange={(e) => onXFinishChange(Number(e.target.value))}
              />
            </label>
            <label className={styles.fieldLabel}>
              Delta (Hz)
              <input
                className={styles.input}
                type="number"
                value={xDelta}
                min={0}
                onChange={(e) => onXDeltaChange(Number(e.target.value))}
              />
            </label>
            {invalidParams && (
              <p className={styles.noteWarning}>
                Finish must be greater than Start, and Delta must be greater than 0 -- showing the auto sweep until fixed.
              </p>
            )}
            {tooCoarse && !invalidParams && (
              <p className={styles.noteWarning}>
                Delta is larger than the whole Start-Finish range, so only those 2 points can be shown -- lower the
                delta to see more of the curve.
              </p>
            )}
            {downsampled && (
              <p className={styles.note}>Delta too fine for this range -- resampled to {pointCount.toLocaleString()} points.</p>
            )}
          </>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.label}>Y-axis (range)</div>
        <div className={styles.toggle}>
          <button className={yMode === "auto" ? styles.active : undefined} onClick={() => onYModeChange("auto")}>
            Auto
          </button>
          <button className={yMode === "manual" ? styles.active : undefined} onClick={() => onYModeChange("manual")}>
            Manual
          </button>
        </div>
        {yMode === "manual" && (
          <>
            <label className={styles.fieldLabel}>
              Min
              <input
                className={styles.input}
                type="number"
                value={yMin}
                onChange={(e) => onYMinChange(Number(e.target.value))}
              />
            </label>
            <label className={styles.fieldLabel}>
              Max
              <input
                className={styles.input}
                type="number"
                value={yMax}
                onChange={(e) => onYMaxChange(Number(e.target.value))}
              />
            </label>
            {yMin >= yMax && (
              <p className={styles.noteWarning}>Max must be greater than Min -- showing auto range until fixed.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
