"use client";

import { useMemo, useRef } from "react";
import {
  Chart as ChartJS,
  LogarithmicScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  type ChartOptions,
} from "chart.js";
import annotationPlugin from "chartjs-plugin-annotation";
import zoomPlugin from "chartjs-plugin-zoom";
import { Line } from "react-chartjs-2";
import type { RComparisonCurve } from "@/lib/rlc";
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

interface Props {
  freqs: number[];
  curves: RComparisonCurve[];
  field: "admittance" | "impedance";
  f0: number;
  yMin?: number;
  yMax?: number;
}

export default function RComparisonChart({ freqs, curves, field, f0, yMin, yMax }: Props) {
  const yLabel = field === "admittance" ? "Admittance |Y| = 1/|Z| (log scale)" : "Impedance |Z| (log scale)";
  const yUnit = field === "admittance" ? "" : " Ω";
  const chartRef = useRef<ChartJS<"line">>(null);

  function handleDownloadCsv() {
    const headers = ["Point", "Frequency_Hz", ...curves.map((c) => `R=${c.R.toPrecision(3)}_${field}`)];
    const rows = freqs.map((f, i) => [i + 1, f, ...curves.map((c) => c[field][i])]);
    downloadCsv(`rlc_${field}_sweep.csv`, headers, rows);
  }

  const data = useMemo(
    () => ({
      datasets: curves.map((curve, i) => ({
        label: `R = ${curve.R.toPrecision(3)} Ω (Q = ${curve.Q.toFixed(2)})`,
        data: freqs.map((f, j) => ({ x: f, y: curve[field][j] })),
        borderColor: CURVE_COLORS[i % CURVE_COLORS.length],
        backgroundColor: CURVE_COLORS[i % CURVE_COLORS.length],
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0,
      })),
    }),
    [freqs, curves, field]
  );

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
          afterBuildTicks: buildLogGraphPaperTicks,
          title: { display: true, text: "Frequency [Hz] (log scale)", color: AXIS_TEXT_COLOR },
          grid: {
            color: (ctx) => logGridColor(ctx, MAJOR_GRID_COLOR, MINOR_GRID_COLOR),
            lineWidth: logGridWidth,
          },
          ticks: { color: AXIS_TEXT_COLOR, callback: logMajorOnlyLabel, autoSkip: false },
        },
        y: {
          type: "logarithmic",
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
            label: (ctx) => `${ctx.dataset.label}: ${(ctx.parsed.y as number).toExponential(3)}${yUnit}`,
          },
        },
        annotation: {
          annotations: {
            resonantLine: {
              type: "line",
              xMin: f0,
              xMax: f0,
              borderColor: RESONANT_COLOR,
              borderWidth: 1.5,
              borderDash: [5, 4],
            },
          },
        },
        // Scroll-wheel and pinch zoom, plus click-drag panning, on both axes.
        zoom: {
          pan: { enabled: true, mode: "xy" },
          zoom: {
            wheel: { enabled: true },
            pinch: { enabled: true },
            mode: "xy",
          },
          limits: { x: { min: "original", max: "original" }, y: { min: "original", max: "original" } },
        },
      },
    }),
    [f0, yLabel, yUnit, yMin, yMax]
  );

  function zoomIn() {
    chartRef.current?.zoom(1.2);
  }
  function zoomOut() {
    chartRef.current?.zoom(0.8);
  }
  function resetZoom() {
    chartRef.current?.resetZoom();
  }

  return (
    <div>
      <div style={{ height: 420, width: "100%" }}>
        <Line ref={chartRef} data={data} options={options} />
      </div>
      <div className={styles.toolbar}>
        <button type="button" onClick={zoomIn}>Zoom in</button>
        <button type="button" onClick={zoomOut}>Zoom out</button>
        <button type="button" onClick={resetZoom}>Reset zoom</button>
        <button type="button" onClick={handleDownloadCsv}>Download CSV</button>
      </div>
    </div>
  );
}
