"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  type ChartOptions,
  type ChartDataset,
} from "chart.js";
import annotationPlugin from "chartjs-plugin-annotation";
import zoomPlugin from "chartjs-plugin-zoom";
import { Line } from "react-chartjs-2";
import {
  buildRComparisonCurves,
  bandwidth,
  halfPowerFrequencies,
  maxCurrent,
  qualityFactor,
  parallelQualityFactor,
  type RComparisonCurve,
  type CircuitType,
} from "@/lib/rlc";
import type { AnnotationOptions } from "chartjs-plugin-annotation";
import { downloadCsv } from "@/lib/csv";
import { makeTooltipHandler, type TooltipReadout as TooltipReadoutData } from "@/lib/chartTooltip";
import TooltipReadout from "./TooltipReadout";
import styles from "./ChartToolbar.module.css";

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend, annotationPlugin, zoomPlugin);

const CURVE_COLORS = ["#1863dc", "#e5484d", "#2f9e58", "#f5a623", "#8b5cf6", "#00aeef"];
const RESONANT_COLOR = "#8a8f98";
const AXIS_TEXT_COLOR = "#8a8f98";
const GRID_COLOR = "rgba(128, 128, 128, 0.15)";

interface Props {
  curves: RComparisonCurve[]; // used for R and Q (each curve's own impedance/admittance arrays are on the OTHER chart's log sweep, not used here)
  f0: number;
  V: number;
  L: number;
  C: number;
  circuitType: CircuitType;
}

/**
 * I = V / |Z|, matching the boss's whiteboard formula (I = V / sqrt(Z), Z
 * being R^2 + (XL-XC)^2 there -- the same sqrt(R^2+(XL-XC)^2) our
 * impedanceMagnitude already computes). This is its OWN chart, on a LINEAR
 * frequency axis zoomed near resonance, rather than mixed onto the log-log
 * Impedance/Admittance board above -- on a log-log scale the peak renders as
 * a sharp inverted-V spike instead of the textbook's rounded selectivity
 * curve (Fig. 17.8), which is what this chart reproduces instead.
 */
export default function CurrentComparisonChart({ curves, f0, V, L, C, circuitType }: Props) {
  const chartRef = useRef<ChartJS<"line">>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartWrapRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);
  // See RComparisonChart.tsx for why this watches the wrap div's real
  // measured size (via ResizeObserver) rather than a fixed-delay resize().
  useEffect(() => {
    const el = chartWrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      chartRef.current?.resize(rect.width, rect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current?.requestFullscreen();
    }
  }
  // See RComparisonChart.tsx for why "Zoom to bandwidth" drives this
  // through normal React state rather than the zoom plugin's own
  // zoomScale()/resetZoom() -- same "original bounds" corruption risk.
  const [xZoomRange, setXZoomRange] = useState<{ min: number; max: number } | null>(null);
  const [readout, setReadout] = useState<TooltipReadoutData | null>(null);

  const rList = useMemo(() => curves.map((c) => c.R), [curves]);

  // Zoomed to a linear range around resonance (not log, and not the whole
  // auto/manual sweep) so the curve reads as the familiar rounded bell shape
  // instead of a razor-thin spike -- bounded by the widest f1-f2 span across
  // all R values, with room either side.
  const { linFreqs, imaxByCurve } = useMemo(() => {
    const f2List = rList.map((R) => {
      const Q = circuitType === "series" ? qualityFactor(R, L, C) : parallelQualityFactor(R, L, C);
      return halfPowerFrequencies(f0, bandwidth(f0, Q)).f2;
    });
    const imaxList = rList.map((R) => maxCurrent(V, R));
    const maxF2 = Math.max(f0, ...f2List);
    const freqMax = Math.max(3 * f0, maxF2 * 1.2);
    // Starts a hair above 0 (not exactly 0 -- Xc = 1/(2*pi*f*C) divides by
    // zero there) so the curve still visibly rises from near-zero current,
    // matching the textbook figure's curve starting at the origin.
    const freqStart = Math.min(freqMax / 100000, 0.01);
    const points = 400;
    const freqs: number[] = new Array(points);
    for (let i = 0; i < points; i++) {
      const t = i / (points - 1);
      freqs[i] = freqStart + t * (freqMax - freqStart);
    }
    return { linFreqs: freqs, imaxByCurve: imaxList };
  }, [f0, rList, V, L, C, circuitType]);

  const linCurves = useMemo(
    () => buildRComparisonCurves(linFreqs, rList, L, C, circuitType),
    [linFreqs, rList, L, C, circuitType]
  );

  const data = useMemo(() => {
    const datasets: ChartDataset<"line", { x: number; y: number }[]>[] = linCurves.map((curve, i) => ({
      label: `I: R = ${curve.R.toPrecision(3)} Ω (Q = ${curves[i]?.Q.toFixed(2) ?? "?"})`,
      data: linFreqs.map((f, j) => ({ x: f, y: V * curve.admittance[j] })),
      borderColor: CURVE_COLORS[i % CURVE_COLORS.length],
      backgroundColor: CURVE_COLORS[i % CURVE_COLORS.length],
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.15,
    }));
    return { datasets };
  }, [linCurves, linFreqs, curves, V]);

  const annotations = useMemo(() => {
    const anns: Record<string, AnnotationOptions> = {
      resonantLine: {
        type: "line",
        xMin: f0,
        xMax: f0,
        borderColor: RESONANT_COLOR,
        borderWidth: 1.5,
        borderDash: [5, 4],
      },
    };
    rList.forEach((R, i) => {
      const color = CURVE_COLORS[i % CURVE_COLORS.length];
      const Q = circuitType === "series" ? qualityFactor(R, L, C) : parallelQualityFactor(R, L, C);
      const { f1, f2 } = halfPowerFrequencies(f0, bandwidth(f0, Q));
      const imax = imaxByCurve[i];
      anns[`f1_${i}`] = { type: "line", xMin: f1, xMax: f1, borderColor: color, borderWidth: 1, borderDash: [2, 3] };
      anns[`f2_${i}`] = { type: "line", xMin: f2, xMax: f2, borderColor: color, borderWidth: 1, borderDash: [2, 3] };
      anns[`imax_${i}`] = {
        type: "line",
        yMin: imax,
        yMax: imax,
        borderColor: color,
        borderWidth: 1,
        borderDash: [5, 3],
        label: {
          display: true,
          content: `Imax = ${imax.toPrecision(4)} A`,
          position: "start",
          xAdjust: 4,
          yAdjust: -10,
          color,
          backgroundColor: "transparent",
          font: { size: 10 },
        },
      };
      anns[`halfPower_${i}`] = {
        type: "line",
        yMin: imax * 0.707,
        yMax: imax * 0.707,
        borderColor: color,
        borderWidth: 1,
        borderDash: [1, 2],
        label: {
          display: true,
          content: `0.707 × Imax = ${(imax * 0.707).toPrecision(4)} A`,
          position: "start",
          xAdjust: 4,
          yAdjust: 12,
          color,
          backgroundColor: "transparent",
          font: { size: 10 },
        },
      };
    });
    return anns;
  }, [f0, rList, L, C, circuitType, imaxByCurve]);

  const yTop = Math.max(...imaxByCurve, 0) * 1.15 || 1;

  const options: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: "nearest", intersect: false, axis: "x" },
      scales: {
        x: {
          type: "linear",
          title: { display: true, text: "Frequency f [Hz]", color: AXIS_TEXT_COLOR },
          grid: { color: GRID_COLOR },
          ticks: { color: AXIS_TEXT_COLOR },
          min: xZoomRange?.min,
          max: xZoomRange?.max,
        },
        y: {
          type: "linear",
          min: 0,
          max: yTop,
          title: { display: true, text: "Current I [A]", color: AXIS_TEXT_COLOR },
          grid: { color: GRID_COLOR },
          ticks: { color: AXIS_TEXT_COLOR },
        },
      },
      plugins: {
        legend: {
          position: "top",
          labels: { color: AXIS_TEXT_COLOR, boxWidth: 20, boxHeight: 2 },
        },
        tooltip: {
          enabled: false,
          external: makeTooltipHandler(setReadout),
          callbacks: {
            title: (items) => `f = ${(items[0].parsed.x as number).toFixed(2)} Hz`,
            label: (ctx) => `${ctx.dataset.label}: ${(ctx.parsed.y as number).toPrecision(4)} A`,
          },
        },
        annotation: { annotations },
        zoom: {
          pan: { enabled: true, mode: "xy", onPanComplete: () => setXZoomRange(null) },
          zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: "xy", onZoomComplete: () => setXZoomRange(null) },
          limits: { x: { min: "original", max: "original" }, y: { min: "original", max: "original" } },
        },
      },
    }),
    [yTop, annotations, xZoomRange]
  );

  function zoomIn() {
    chartRef.current?.zoom(1.2);
  }
  function zoomOut() {
    chartRef.current?.zoom(0.8);
  }
  function resetZoom() {
    if (xZoomRange) {
      setXZoomRange(null);
    } else {
      chartRef.current?.resetZoom();
    }
  }
  function zoomToBandwidth() {
    if (rList.length === 0) return;
    let minF1 = Infinity;
    let maxF2 = -Infinity;
    rList.forEach((R) => {
      const Q = circuitType === "series" ? qualityFactor(R, L, C) : parallelQualityFactor(R, L, C);
      const { f1, f2 } = halfPowerFrequencies(f0, bandwidth(f0, Q));
      minF1 = Math.min(minF1, f1);
      maxF2 = Math.max(maxF2, f2);
    });
    const pad = 1.15;
    setXZoomRange({ min: minF1 / pad, max: maxF2 * pad });
  }

  function handleDownloadCsv() {
    const headers = ["Point", "Frequency_Hz", ...linCurves.flatMap((c) => [`Current_R=${c.R.toPrecision(3)}_Amp`])];
    const rows = linFreqs.map((f, i) => [i + 1, f, ...linCurves.map((c) => V * c.admittance[i])]);
    downloadCsv("rlc_current_sweep.csv", headers, rows);
  }

  return (
    <div ref={containerRef} className={styles.fullscreenWrap}>
      {isFullscreen && (
        <button
          type="button"
          className={styles.fullscreenCloseBtn}
          onClick={toggleFullscreen}
          aria-label="Exit fullscreen"
          title="Exit fullscreen"
        >
          ×
        </button>
      )}
      <div className={styles.splitColHeader}>
        <div className={styles.chartTitle} style={{ marginBottom: 0 }}>Current I vs Frequency (Selectivity Curve)</div>
        <TooltipReadout data={readout} placeholder="Hover to see exact values" />
      </div>
      <p className={styles.note}>
        <strong>I = V / |Z|</strong>, peaking at <strong>Imax = V / R</strong> right at resonance (where |Z| = R).
        <strong> 0.707 × Imax</strong> is the half-power level; the dotted vertical lines are that curve&apos;s f1 and
        f2, same as the Bandwidth lines on the Impedance/Admittance chart above.
      </p>
      <div ref={chartWrapRef} style={{ height: isFullscreen ? "calc(100vh - 320px)" : 420, width: "100%" }}>
        <Line ref={chartRef} data={data} options={options} />
      </div>
      <div className={styles.toolbar}>
        <button type="button" onClick={zoomIn}>Zoom in</button>
        <button type="button" onClick={zoomOut}>Zoom out</button>
        <button type="button" onClick={zoomToBandwidth}>Zoom to bandwidth</button>
        <button type="button" onClick={resetZoom}>Reset zoom</button>
        <button type="button" onClick={toggleFullscreen}>
          {isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
        </button>
        <button type="button" onClick={handleDownloadCsv}>Download CSV</button>
      </div>
    </div>
  );
}
