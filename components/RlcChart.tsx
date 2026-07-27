"use client";

import { useMemo, useRef } from "react";
import {
  Chart as ChartJS,
  LogarithmicScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  type ChartOptions,
} from "chart.js";
import annotationPlugin from "chartjs-plugin-annotation";
import zoomPlugin from "chartjs-plugin-zoom";
import { Line } from "react-chartjs-2";
import { buildExportFrequencies, reactanceAtFreqs, type ReactancePoints, type SweepParams } from "@/lib/rlc";
import { buildLogGraphPaperTicks, logMajorOnlyLabel, logGridColor, logGridWidth } from "@/lib/logAxis";
import { downloadCsv } from "@/lib/csv";
import styles from "./ChartToolbar.module.css";

ChartJS.register(
  LogarithmicScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  annotationPlugin,
  zoomPlugin
);

// Colors follow the whiteboard sketch's own convention (red = Xc, blue =
// XL), not a generic categorical palette; the mapping is the whole point
// of the chart, so it stays fixed rather than being reassigned.
const XC_COLOR = "#e5484d";
const XL_COLOR = "#3b82f6";
const RESONANT_COLOR = "#2f9e58";
const MAJOR_GRID_COLOR = "rgba(128, 128, 128, 0.4)";
const MINOR_GRID_COLOR = "rgba(128, 128, 128, 0.15)";
const AXIS_TEXT_COLOR = "#8a8f98";

interface Props {
  reactance: ReactancePoints;
  f0: number;
  logY?: boolean;
  yMin?: number;
  yMax?: number;
  L: number;
  C: number;
  sweepParams: SweepParams;
}

export default function RlcChart({ reactance, f0, logY = false, yMin, yMax, L, C, sweepParams }: Props) {
  const { freqs, xc, xl } = reactance;
  const chartRef = useRef<ChartJS<"line">>(null);

  function handleDownloadCsv() {
    // Full requested resolution, independent of whatever the chart itself
    // downsampled to for smooth rendering -- a request for 100,000 points
    // should produce a 100,001-row CSV, not the ~2,000-row chart version.
    const exportFreqs = buildExportFrequencies(f0, sweepParams);
    const exportReactance = reactanceAtFreqs(exportFreqs, L, C);
    const rows = exportFreqs.map((f, i) => [i + 1, f, exportReactance.xc[i], exportReactance.xl[i]]);
    downloadCsv("rlc_xc_xl_sweep.csv", ["Point", "Frequency_Hz", "Xc_Ohm", "XL_Ohm"], rows);
  }

  const data = useMemo(
    () => ({
      datasets: [
        {
          label: "Xc (capacitive reactance)",
          data: freqs.map((f, i) => ({ x: f, y: xc[i] })),
          borderColor: XC_COLOR,
          backgroundColor: XC_COLOR,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0,
        },
        {
          label: "XL (inductive reactance)",
          data: freqs.map((f, i) => ({ x: f, y: xl[i] })),
          borderColor: XL_COLOR,
          backgroundColor: XL_COLOR,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0,
        },
      ],
    }),
    [freqs, xc, xl]
  );

  const options: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      // Data changes on every keystroke while typing a manual axis value;
      // Chart.js's default transition animation can't keep up with rapid
      // updates and shows a jumbled in-between frame, which looks like a
      // rendering bug. Disabling animation makes every update snap
      // instantly to the correct final state instead.
      animation: false,
      interaction: { mode: "nearest", intersect: false, axis: "x" },
      scales: {
        x: {
          type: "logarithmic",
          // Chart.js's own scale option `bounds` defaults to "ticks", which
          // snaps the axis's actual min/max to Chart.js's OWN internal tick
          // generation (run before afterBuildTicks below ever sees it) --
          // e.g. a Finish of 200,000 Hz would get silently clamped to the
          // 100,000 gridline since that's a "nicer" tick boundary. "data"
          // makes the axis span the real requested Start/Finish exactly.
          bounds: "data",
          afterBuildTicks: buildLogGraphPaperTicks,
          title: { display: true, text: "Frequency [Hz] (log scale)", color: AXIS_TEXT_COLOR },
          grid: {
            color: (ctx) => logGridColor(ctx, MAJOR_GRID_COLOR, MINOR_GRID_COLOR),
            lineWidth: logGridWidth,
          },
          ticks: { color: AXIS_TEXT_COLOR, callback: logMajorOnlyLabel, autoSkip: false },
        },
        y: logY
          ? {
              type: "logarithmic",
              bounds: "data",
              afterBuildTicks: buildLogGraphPaperTicks,
              title: { display: true, text: "Impedance [Ω] (log scale)", color: AXIS_TEXT_COLOR },
              grid: {
                color: (ctx) => logGridColor(ctx, MAJOR_GRID_COLOR, MINOR_GRID_COLOR),
                lineWidth: logGridWidth,
              },
              ticks: { color: AXIS_TEXT_COLOR, callback: logMajorOnlyLabel, autoSkip: false },
              min: yMin,
              max: yMax,
            }
          : {
              type: "linear",
              title: { display: true, text: "Impedance [Ω]", color: AXIS_TEXT_COLOR },
              grid: { color: MINOR_GRID_COLOR },
              ticks: { color: AXIS_TEXT_COLOR },
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
            label: (ctx) => `${ctx.dataset.label}: ${(ctx.parsed.y as number).toFixed(2)} Ω`,
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
              label: {
                display: true,
                content: "resonant freq",
                position: "start",
                rotation: 90,
                color: RESONANT_COLOR,
                backgroundColor: "transparent",
                font: { size: 11, weight: "normal" },
                xAdjust: -10,
              },
            },
          },
        },
        // Scroll-wheel and pinch zoom, plus click-drag panning, on both
        // axes -- lets a user zoom into the resonance crossing point
        // directly on the chart, on top of the Start/Finish/Points fields.
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
    [f0, logY, yMin, yMax]
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
