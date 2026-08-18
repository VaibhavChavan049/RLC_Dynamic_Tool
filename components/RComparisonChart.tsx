"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  Chart as ChartJS,
  LogarithmicScale,
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
  buildExportFrequencies,
  buildRComparisonCurves,
  bandwidth,
  halfPowerFrequencies,
  type RComparisonCurve,
  type CircuitType,
  type SweepParams,
} from "@/lib/rlc";
import type { AnnotationOptions } from "chartjs-plugin-annotation";
import { buildLogGraphPaperTicks, logMajorOnlyLabel, logGridColor, logGridWidth } from "@/lib/logAxis";
import { downloadCsv } from "@/lib/csv";
import { makeTooltipHandler, type TooltipReadout as TooltipReadoutData } from "@/lib/chartTooltip";
import TooltipReadout from "./TooltipReadout";
import styles from "./ChartToolbar.module.css";

ChartJS.register(LogarithmicScale, PointElement, LineElement, Tooltip, Legend, annotationPlugin, zoomPlugin);

// Cycled in the order R values are added to the comparison list -- there's
// no fixed "lower/current/higher" meaning anymore since the list is
// user-built, so colors just distinguish curves rather than encode meaning.
const CURVE_COLORS = ["#1863dc", "#e5484d", "#2f9e58", "#f5a623", "#8b5cf6", "#00aeef"];
const RESONANT_COLOR = "#8a8f98";
const MAJOR_GRID_COLOR = "rgba(100, 116, 139, 0.35)";
const MINOR_GRID_COLOR = "rgba(100, 116, 139, 0.13)";
const AXIS_TEXT_COLOR = "#8a8f98";

interface Props {
  freqs: number[];
  curves: RComparisonCurve[];
  f0: number;
  yMin?: number;
  yMax?: number;
  L: number;
  C: number;
  circuitType: CircuitType;
  sweepParams: SweepParams;
}

// Keeps a Chart.js canvas in sync with its wrapper div's real measured size
// (see the long ResizeObserver-vs-fixed-delay note this used to carry --
// still applies). Impedance and Admittance are now two separate canvases
// side by side, so each needs its own observer instance.
function useChartResize(wrapRef: RefObject<HTMLDivElement | null>, chartRef: RefObject<ChartJS<"line"> | null>) {
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      chartRef.current?.resize(rect.width, rect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [wrapRef, chartRef]);
}

export default function RComparisonChart({ freqs, curves, f0, yMin, yMax, L, C, circuitType, sweepParams }: Props) {
  const zChartRef = useRef<ChartJS<"line">>(null);
  const yChartRef = useRef<ChartJS<"line">>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zWrapRef = useRef<HTMLDivElement>(null);
  const yWrapRef = useRef<HTMLDivElement>(null);
  // Native Fullscreen API rather than a CSS overlay -- the browser handles
  // Escape-to-exit for free.
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);
  useChartResize(zWrapRef, zChartRef);
  useChartResize(yWrapRef, yChartRef);
  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current?.requestFullscreen();
    }
  }
  // "Zoom to bandwidth" sets this explicitly (fed straight into both charts'
  // x-scale options below); "Reset zoom" clears it back to null so
  // bounds: "data" auto-computes the full range again. Driving this through
  // normal React state -- rather than chartjs-plugin-zoom's own
  // zoomScale()/resetZoom() -- sidesteps that plugin's internal "original
  // scale bounds" bookkeeping, which gets corrupted by a React re-render
  // landing between the two calls and silently "resets" back to the zoomed
  // range instead of the true one.
  const [xZoomRange, setXZoomRange] = useState<{ min: number; max: number } | null>(null);
  // Both charts shown side by side by default; unchecking one hides that
  // column entirely (the other then takes the full row) -- independent
  // toggles, not a single either/or, so both can also be hidden at once.
  const [showImpedance, setShowImpedance] = useState(true);
  const [showAdmittance, setShowAdmittance] = useState(true);
  // Marks each curve's half-power (bandwidth) frequencies f1/f2 -- the
  // textbook shows these as the points where the curve crosses the
  // half-power level, bounding the shaded bandwidth region under the peak.
  const [showBandwidth, setShowBandwidth] = useState(true);
  const [zReadout, setZReadout] = useState<TooltipReadoutData | null>(null);
  const [yReadout, setYReadout] = useState<TooltipReadoutData | null>(null);

  function handleDownloadCsv() {
    // Full requested resolution, independent of whatever the chart itself
    // downsampled to for smooth rendering -- a request for 100,000 points
    // should produce a 100,001-row CSV, not the ~2,000-row chart version.
    const exportFreqs = buildExportFrequencies(f0, sweepParams);
    const rList = curves.map((c) => c.R);
    const exportCurves = buildRComparisonCurves(exportFreqs, rList, L, C, circuitType);
    const headers = [
      "Point",
      "Frequency_Hz",
      ...exportCurves.flatMap((c) => [`Impedance_R=${c.R.toPrecision(3)}_Ohm`, `Admittance_R=${c.R.toPrecision(3)}_Siemens`]),
    ];
    const rows = exportFreqs.map((f, i) => [
      i + 1,
      f,
      ...exportCurves.flatMap((c) => [c.impedance[i], c.admittance[i]]),
    ]);
    downloadCsv("rlc_impedance_admittance_sweep.csv", headers, rows);
  }

  const zData = useMemo(() => {
    const datasets: ChartDataset<"line", { x: number; y: number }[]>[] = curves.map((curve, i) => ({
      label: `R = ${curve.R.toPrecision(3)} Ω (Q = ${curve.Q.toFixed(2)})`,
      data: freqs.map((f, j) => ({ x: f, y: curve.impedance[j] })),
      borderColor: CURVE_COLORS[i % CURVE_COLORS.length],
      backgroundColor: CURVE_COLORS[i % CURVE_COLORS.length],
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0,
    }));
    return { datasets };
  }, [freqs, curves]);

  const yData = useMemo(() => {
    const datasets: ChartDataset<"line", { x: number; y: number }[]>[] = curves.map((curve, i) => ({
      label: `R = ${curve.R.toPrecision(3)} Ω (Q = ${curve.Q.toFixed(2)})`,
      data: freqs.map((f, j) => ({ x: f, y: curve.admittance[j] })),
      borderColor: CURVE_COLORS[i % CURVE_COLORS.length],
      backgroundColor: CURVE_COLORS[i % CURVE_COLORS.length],
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0,
    }));
    return { datasets };
  }, [freqs, curves]);

  // f1/f2 per curve, color-matched to that curve -- x-position only (no y
  // bound), so the same annotation set applies unchanged to both the
  // Impedance and Admittance charts even though their y-scales differ.
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
    if (showBandwidth) {
      curves.forEach((curve, i) => {
        const color = CURVE_COLORS[i % CURVE_COLORS.length];
        const BW = bandwidth(f0, curve.Q);
        const { f1, f2 } = halfPowerFrequencies(f0, BW);
        anns[`f1_${i}`] = {
          type: "line",
          xMin: f1,
          xMax: f1,
          borderColor: color,
          borderWidth: 1,
          borderDash: [2, 3],
        };
        anns[`f2_${i}`] = {
          type: "line",
          xMin: f2,
          xMax: f2,
          borderColor: color,
          borderWidth: 1,
          borderDash: [2, 3],
        };
      });
    }
    return anns;
  }, [f0, curves, showBandwidth]);

  const zOptions: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: "nearest", intersect: false, axis: "x" },
      scales: {
        x: {
          type: "logarithmic",
          bounds: "data",
          afterBuildTicks: buildLogGraphPaperTicks,
          title: { display: true, text: "Frequency [Hz] (log scale)", color: AXIS_TEXT_COLOR },
          grid: { color: (ctx) => logGridColor(ctx, MAJOR_GRID_COLOR, MINOR_GRID_COLOR), lineWidth: logGridWidth },
          ticks: { color: AXIS_TEXT_COLOR, callback: logMajorOnlyLabel, autoSkip: false },
          min: xZoomRange?.min,
          max: xZoomRange?.max,
        },
        y: {
          type: "logarithmic",
          bounds: "data",
          afterBuildTicks: buildLogGraphPaperTicks,
          title: { display: true, text: "Impedance |Z| [Ω] (log scale)", color: AXIS_TEXT_COLOR },
          grid: { color: (ctx) => logGridColor(ctx, MAJOR_GRID_COLOR, MINOR_GRID_COLOR), lineWidth: logGridWidth },
          ticks: { color: AXIS_TEXT_COLOR, callback: logMajorOnlyLabel, autoSkip: false },
          min: yMin,
          max: yMax,
        },
      },
      plugins: {
        legend: { position: "top", labels: { color: AXIS_TEXT_COLOR, boxWidth: 20, boxHeight: 2 } },
        tooltip: {
          // See RlcChart.tsx: rendered into a fixed readout next to the
          // title instead, so it never covers the point you're hovering.
          enabled: false,
          external: makeTooltipHandler(setZReadout),
          callbacks: {
            title: (items) => `f = ${(items[0].parsed.x as number).toFixed(2)} Hz`,
            label: (ctx) => `${ctx.dataset.label}: ${(ctx.parsed.y as number).toExponential(3)} Ω`,
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
    [yMin, yMax, annotations, xZoomRange]
  );

  const yOptions: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: "nearest", intersect: false, axis: "x" },
      scales: {
        x: {
          type: "logarithmic",
          bounds: "data",
          afterBuildTicks: buildLogGraphPaperTicks,
          title: { display: true, text: "Frequency [Hz] (log scale)", color: AXIS_TEXT_COLOR },
          grid: { color: (ctx) => logGridColor(ctx, MAJOR_GRID_COLOR, MINOR_GRID_COLOR), lineWidth: logGridWidth },
          ticks: { color: AXIS_TEXT_COLOR, callback: logMajorOnlyLabel, autoSkip: false },
          min: xZoomRange?.min,
          max: xZoomRange?.max,
        },
        y: {
          type: "logarithmic",
          bounds: "data",
          afterBuildTicks: buildLogGraphPaperTicks,
          title: { display: true, text: "Admittance |Y| = 1/|Z| [S] (log scale)", color: AXIS_TEXT_COLOR },
          grid: { color: (ctx) => logGridColor(ctx, MAJOR_GRID_COLOR, MINOR_GRID_COLOR), lineWidth: logGridWidth },
          ticks: { color: AXIS_TEXT_COLOR, callback: logMajorOnlyLabel, autoSkip: false },
          min: yMin,
          max: yMax,
        },
      },
      plugins: {
        legend: { position: "top", labels: { color: AXIS_TEXT_COLOR, boxWidth: 20, boxHeight: 2 } },
        tooltip: {
          enabled: false,
          external: makeTooltipHandler(setYReadout),
          callbacks: {
            title: (items) => `f = ${(items[0].parsed.x as number).toFixed(2)} Hz`,
            label: (ctx) => `${ctx.dataset.label}: ${(ctx.parsed.y as number).toExponential(3)} S`,
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
    [yMin, yMax, annotations, xZoomRange]
  );

  // Toolbar buttons act on both charts together so the two stay in step --
  // they share the same frequency axis, so a lopsided zoom between them
  // would be confusing rather than useful.
  function zoomIn() {
    zChartRef.current?.zoom(1.2);
    yChartRef.current?.zoom(1.2);
  }
  function zoomOut() {
    zChartRef.current?.zoom(0.8);
    yChartRef.current?.zoom(0.8);
  }
  function resetZoom() {
    if (xZoomRange) {
      // "Zoom to bandwidth" is the active zoom -- clearing our own state is
      // enough. Also calling chart.resetZoom() here would make
      // chartjs-plugin-zoom re-derive its own "original scale bounds"
      // bookkeeping from the CURRENT (still zoomed, at the moment this runs)
      // scale, corrupting it into "resetting" right back to that zoomed
      // range instead of the true original.
      setXZoomRange(null);
    } else {
      // Otherwise a wheel/pinch/drag zoom is active, tracked entirely
      // inside each chart's own plugin instance -- its own reset undoes that.
      zChartRef.current?.resetZoom();
      yChartRef.current?.resetZoom();
    }
  }
  function zoomToBandwidth() {
    if (curves.length === 0) return;
    // Fits the X-axis to the widest f1-f2 span across all curves, with 15%
    // breathing room either side (in log terms) -- at the full auto/manual
    // sweep range the bandwidth region is often a tiny sliver near the
    // resonant line, easy to miss with several curves' f1/f2 lines bunched
    // together; this snaps straight to the readable close-up view.
    let minF1 = Infinity;
    let maxF2 = -Infinity;
    curves.forEach((curve) => {
      const { f1, f2 } = halfPowerFrequencies(f0, bandwidth(f0, curve.Q));
      minF1 = Math.min(minF1, f1);
      maxF2 = Math.max(maxF2, f2);
    });
    const pad = 1.15;
    setXZoomRange({ min: minF1 / pad, max: maxF2 * pad });
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
      <div className={styles.metricToggleRow}>
        <label>
          <input type="checkbox" checked={showImpedance} onChange={(e) => setShowImpedance(e.target.checked)} />
          Impedance |Z| (Ω)
        </label>
        <label>
          <input type="checkbox" checked={showAdmittance} onChange={(e) => setShowAdmittance(e.target.checked)} />
          Admittance |Y| = 1/|Z| (S)
        </label>
        <label>
          <input type="checkbox" checked={showBandwidth} onChange={(e) => setShowBandwidth(e.target.checked)} />
          Bandwidth (f1/f2)
        </label>
      </div>
      {!showImpedance && !showAdmittance && (
        <p className={styles.noteWarning}>Both metrics are hidden. Check at least one box above to see a chart.</p>
      )}
      {showBandwidth && (
        <p className={styles.note}>
          Thin dotted lines mark each curve&apos;s half-power frequencies f1 and f2 (same color as its curve). The gap
          between them is that R&apos;s bandwidth.
        </p>
      )}
      <div className={styles.splitRow}>
        {showImpedance && (
          <div className={styles.splitCol}>
            <div className={styles.splitColHeader}>
              <div className={styles.splitColTitle}>Impedance |Z| vs Frequency</div>
              <TooltipReadout data={zReadout} placeholder="Hover to see exact values" />
            </div>
            <div ref={zWrapRef} style={{ height: isFullscreen ? "calc(100vh - 320px)" : 420, width: "100%" }}>
              <Line ref={zChartRef} data={zData} options={zOptions} />
            </div>
          </div>
        )}
        {showAdmittance && (
          <div className={styles.splitCol}>
            <div className={styles.splitColHeader}>
              <div className={styles.splitColTitle}>Admittance |Y| vs Frequency</div>
              <TooltipReadout data={yReadout} placeholder="Hover to see exact values" />
            </div>
            <div ref={yWrapRef} style={{ height: isFullscreen ? "calc(100vh - 320px)" : 420, width: "100%" }}>
              <Line ref={yChartRef} data={yData} options={yOptions} />
            </div>
          </div>
        )}
      </div>
      <div className={styles.toolbar}>
        <button type="button" onClick={zoomIn}>Zoom in</button>
        <button type="button" onClick={zoomOut}>Zoom out</button>
        {showBandwidth && (
          <button type="button" onClick={zoomToBandwidth}>Zoom to bandwidth</button>
        )}
        <button type="button" onClick={resetZoom}>Reset zoom</button>
        <button type="button" onClick={toggleFullscreen}>
          {isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
        </button>
        <button type="button" onClick={handleDownloadCsv}>Download CSV</button>
      </div>
    </div>
  );
}
