"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  maxCurrent,
  type RComparisonCurve,
  type CircuitType,
  type SweepParams,
} from "@/lib/rlc";
import type { AnnotationOptions } from "chartjs-plugin-annotation";
import { buildLogGraphPaperTicks, logMajorOnlyLabel, logGridColor, logGridWidth } from "@/lib/logAxis";
import { downloadCsv } from "@/lib/csv";
import styles from "./ChartToolbar.module.css";

ChartJS.register(LogarithmicScale, PointElement, LineElement, Tooltip, Legend, annotationPlugin, zoomPlugin);

// Cycled in the order R values are added to the comparison list -- there's
// no fixed "lower/current/higher" meaning anymore since the list is
// user-built, so colors just distinguish curves rather than encode meaning.
const CURVE_COLORS = ["#1863dc", "#e5484d", "#2f9e58", "#f5a623", "#8b5cf6", "#00aeef"];
const RESONANT_COLOR = "#8a8f98";
const MAJOR_GRID_COLOR = "rgba(128, 128, 128, 0.4)";
const MINOR_GRID_COLOR = "rgba(128, 128, 128, 0.15)";
const AXIS_TEXT_COLOR = "#8a8f98";

// Impedance is drawn solid, Admittance dashed -- same color per R value, so
// the two curve families stay visually distinguishable even when both are
// shown together on one board (they're reciprocals: |Y| = 1/|Z|).
const IMPEDANCE_DASH: number[] = [];
const ADMITTANCE_DASH = [6, 4];
const CURRENT_DASH = [2, 2];

interface Props {
  freqs: number[];
  curves: RComparisonCurve[];
  f0: number;
  V: number;
  yMin?: number;
  yMax?: number;
  L: number;
  C: number;
  circuitType: CircuitType;
  sweepParams: SweepParams;
}

export default function RComparisonChart({ freqs, curves, f0, V, yMin, yMax, L, C, circuitType, sweepParams }: Props) {
  const chartRef = useRef<ChartJS<"line">>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartWrapRef = useRef<HTMLDivElement>(null);
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
  // Chart.js's own responsive:true resize doesn't reliably catch a size
  // change driven by exiting the browser's native Fullscreen mode -- a
  // fixed-delay nudge (the previous approach here) raced the exit
  // transition: it fired before the container had actually shrunk back
  // down, so Chart.js measured the still-fullscreen (viewport-wide) size
  // and baked that width into the canvas, which then overflowed the whole
  // page layout even after the surrounding div was back to 420px. Watching
  // the wrap div's REAL measured size via ResizeObserver and resizing only
  // once it actually changes sidesteps the race entirely.
  useEffect(() => {
    const el = chartWrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      // Passing the exact measured size (rather than calling resize()
      // with no arguments, which asks Chart.js to auto-detect it again
      // itself) bypasses whatever internal comparison/caching was
      // returning a stale, still-fullscreen-sized answer.
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
  // "Zoom to bandwidth" sets this explicitly (fed straight into the x-scale
  // options below); "Reset zoom" clears it back to null so bounds: "data"
  // auto-computes the full range again. Driving this through normal React
  // state -- rather than chartjs-plugin-zoom's own zoomScale()/resetZoom()
  // -- sidesteps that plugin's internal "original scale bounds" bookkeeping,
  // which gets corrupted by a React re-render landing between the two calls
  // and silently "resets" back to the zoomed range instead of the true one.
  const [xZoomRange, setXZoomRange] = useState<{ min: number; max: number } | null>(null);
  // Both metrics shown on the board by default; unchecking one leaves only
  // the other visible -- these are independent, not a single either/or
  // toggle, so both can also be hidden if the user unchecks both.
  const [showImpedance, setShowImpedance] = useState(true);
  const [showAdmittance, setShowAdmittance] = useState(true);
  // Marks each curve's half-power (bandwidth) frequencies f1/f2 -- the
  // textbook shows these as the points where the curve crosses the
  // half-power level, bounding the shaded bandwidth region under the peak.
  const [showBandwidth, setShowBandwidth] = useState(true);
  // Current I = V * |Y| (Ohm's law through the reciprocal of impedance) --
  // its own dotted curve per R, plus the Imax/0.707*Imax reference lines
  // from the textbook's selectivity-curve figure (Imax = V/R, reached at
  // resonance since |Z| = R there for both topologies).
  const [showCurrent, setShowCurrent] = useState(true);

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
      ...exportCurves.flatMap((c) => [
        `Impedance_R=${c.R.toPrecision(3)}_Ohm`,
        `Admittance_R=${c.R.toPrecision(3)}_Siemens`,
        `Current_R=${c.R.toPrecision(3)}_Amp`,
      ]),
    ];
    const rows = exportFreqs.map((f, i) => [
      i + 1,
      f,
      ...exportCurves.flatMap((c) => [c.impedance[i], c.admittance[i], V * c.admittance[i]]),
    ]);
    downloadCsv("rlc_impedance_admittance_sweep.csv", headers, rows);
  }

  const data = useMemo(() => {
    const datasets: ChartDataset<"line", { x: number; y: number }[]>[] = [];
    curves.forEach((curve, i) => {
      const color = CURVE_COLORS[i % CURVE_COLORS.length];
      if (showImpedance) {
        datasets.push({
          label: `Z: R = ${curve.R.toPrecision(3)} Ω (Q = ${curve.Q.toFixed(2)})`,
          data: freqs.map((f, j) => ({ x: f, y: curve.impedance[j] })),
          borderColor: color,
          backgroundColor: color,
          borderDash: IMPEDANCE_DASH,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0,
        });
      }
      if (showAdmittance) {
        datasets.push({
          label: `Y: R = ${curve.R.toPrecision(3)} Ω (Q = ${curve.Q.toFixed(2)})`,
          data: freqs.map((f, j) => ({ x: f, y: curve.admittance[j] })),
          borderColor: color,
          backgroundColor: color,
          borderDash: ADMITTANCE_DASH,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0,
        });
      }
      if (showCurrent) {
        datasets.push({
          label: `I: R = ${curve.R.toPrecision(3)} Ω (Q = ${curve.Q.toFixed(2)})`,
          data: freqs.map((f, j) => ({ x: f, y: V * curve.admittance[j] })),
          borderColor: color,
          backgroundColor: color,
          borderDash: CURRENT_DASH,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0,
        });
      }
    });
    return { datasets };
  }, [freqs, curves, showImpedance, showAdmittance, showCurrent, V]);

  const yLabel = (() => {
    const parts: string[] = [];
    if (showImpedance) parts.push("Impedance [Ω] (solid)");
    if (showAdmittance) parts.push("Admittance [S] (dashed)");
    if (showCurrent) parts.push("Current [A] (dotted)");
    return parts.length > 0 ? `${parts.join(" / ")}, log scale` : "log scale";
  })();

  // f1/f2 per curve, color-matched to that curve -- labeled only when a
  // single curve is shown (multiple curves would otherwise stack "f1"/"f2"
  // text on top of each other).
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
    if (showCurrent) {
      curves.forEach((curve, i) => {
        const color = CURVE_COLORS[i % CURVE_COLORS.length];
        const imax = maxCurrent(V, curve.R);
        anns[`imax_${i}`] = {
          type: "line",
          yMin: imax,
          yMax: imax,
          borderColor: color,
          borderWidth: 1,
          borderDash: [5, 3],
        };
        anns[`halfPowerCurrent_${i}`] = {
          type: "line",
          yMin: imax * 0.707,
          yMax: imax * 0.707,
          borderColor: color,
          borderWidth: 1,
          borderDash: [1, 2],
        };
      });
    }
    return anns;
  }, [f0, curves, showBandwidth, showCurrent, V]);

  const options: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      // See RlcChart.tsx: disable animation so rapid updates (e.g. typing a
      // manual axis value) snap instantly instead of showing a jumbled
      // in-between transition frame.
      animation: false,
      interaction: { mode: "nearest", intersect: false, axis: "x" },
      scales: {
        x: {
          type: "logarithmic",
          // See RlcChart.tsx: "bounds" defaults to "ticks" in Chart.js,
          // which snaps the axis's real min/max to Chart.js's own internal
          // tick generation instead of the actual requested Start/Finish.
          // "data" keeps the axis honest to the real range.
          bounds: "data",
          afterBuildTicks: buildLogGraphPaperTicks,
          title: { display: true, text: "Frequency [Hz] (log scale)", color: AXIS_TEXT_COLOR },
          grid: {
            color: (ctx) => logGridColor(ctx, MAJOR_GRID_COLOR, MINOR_GRID_COLOR),
            lineWidth: logGridWidth,
          },
          ticks: { color: AXIS_TEXT_COLOR, callback: logMajorOnlyLabel, autoSkip: false },
          min: xZoomRange?.min,
          max: xZoomRange?.max,
        },
        y: {
          type: "logarithmic",
          bounds: "data",
          afterBuildTicks: buildLogGraphPaperTicks,
          title: { display: true, text: yLabel, color: AXIS_TEXT_COLOR },
          grid: {
            color: (ctx) => logGridColor(ctx, MAJOR_GRID_COLOR, MINOR_GRID_COLOR),
            lineWidth: logGridWidth,
          },
          ticks: { color: AXIS_TEXT_COLOR, callback: logMajorOnlyLabel, autoSkip: false },
          min: yMin,
          max: yMax,
        },
      },
      plugins: {
        legend: {
          position: "top",
          labels: { color: AXIS_TEXT_COLOR, boxWidth: 20, boxHeight: 2 },
        },
        tooltip: {
          callbacks: {
            title: (items) => `f = ${(items[0].parsed.x as number).toFixed(2)} Hz`,
            label: (ctx) => {
              const label = ctx.dataset.label ?? "";
              const value = ctx.parsed.y as number;
              if (label.startsWith("Y:")) return `${label}: ${value.toExponential(3)} S`;
              if (label.startsWith("I:")) return `${label}: ${value.toExponential(3)} A`;
              return `${label}: ${value.toExponential(3)} Ω`;
            },
          },
        },
        annotation: { annotations },
        // Scroll-wheel and pinch zoom, plus click-drag panning, on both axes.
        zoom: {
          pan: {
            enabled: true,
            mode: "xy",
            // A manual pan after "Zoom to bandwidth" should stick -- clear
            // our own React-driven range so the next unrelated re-render
            // doesn't snap the x-axis back to the bandwidth-zoom range.
            onPanComplete: () => setXZoomRange(null),
          },
          zoom: {
            wheel: { enabled: true },
            pinch: { enabled: true },
            mode: "xy",
            onZoomComplete: () => setXZoomRange(null),
          },
          limits: { x: { min: "original", max: "original" }, y: { min: "original", max: "original" } },
        },
      },
    }),
    [yLabel, yMin, yMax, annotations, xZoomRange]
  );

  function zoomIn() {
    chartRef.current?.zoom(1.2);
  }
  function zoomOut() {
    chartRef.current?.zoom(0.8);
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
      // inside the plugin -- its own reset is what undoes that.
      chartRef.current?.resetZoom();
    }
  }
  function zoomToBandwidth() {
    if (curves.length === 0) return;
    // Fits the X-axis to the widest f1-f2 span across all curves, with 15%
    // breathing room either side (in log terms) -- at the full auto/manual
    // sweep range the bandwidth region is often a tiny sliver near the
    // resonant line, easy to miss with several curves' f1/f2 lines bunched
    // together; this snaps straight to the readable close-up view. Setting
    // our own React state (rather than calling the zoom plugin's own
    // zoomScale()) means the range flows through the normal options ->
    // chart.update() path, the same reliable path every other option on
    // this chart already uses.
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
        <label>
          <input type="checkbox" checked={showCurrent} onChange={(e) => setShowCurrent(e.target.checked)} />
          Current I = V·|Y| (A)
        </label>
      </div>
      {!showImpedance && !showAdmittance && !showCurrent && (
        <p className={styles.noteWarning}>All metrics are hidden. Check at least one box above to see a curve.</p>
      )}
      {showBandwidth && (
        <p className={styles.note}>
          Thin dotted lines mark each curve&apos;s half-power frequencies f1 and f2 (same color as its curve). The gap
          between them is that R&apos;s bandwidth.
        </p>
      )}
      {showCurrent && (
        <p className={styles.note}>
          Dashed lines mark each curve&apos;s peak current Imax = V / R (top line) and its 0.707 × Imax half-power
          level (lower line), same color as its curve.
        </p>
      )}
      <div ref={chartWrapRef} style={{ height: isFullscreen ? "calc(100vh - 320px)" : 420, width: "100%" }}>
        <Line ref={chartRef} data={data} options={options} />
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
