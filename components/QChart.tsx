"use client";

import { useMemo } from "react";
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
import { Line } from "react-chartjs-2";
import type { QComparisonSweep } from "@/lib/rlc";

ChartJS.register(LogarithmicScale, PointElement, LineElement, Tooltip, Legend, annotationPlugin);

// Same color meaning as the terminal script's version of this chart: green
// = lower R / higher Q (sharper peak), blue = the entered R, red = higher
// R / lower Q (wider peak).
const CURVE_COLORS = ["#2f9e58", "#1863dc", "#e5484d"];
const RESONANT_COLOR = "#8a8f98";
const GRID_COLOR = "rgba(128, 128, 128, 0.18)";
const AXIS_TEXT_COLOR = "#8a8f98";

interface Props {
  sweep: QComparisonSweep;
}

export default function QChart({ sweep }: Props) {
  const { freqs, curves, f0 } = sweep;

  const data = useMemo(
    () => ({
      datasets: curves.map((curve, i) => ({
        label: `${curve.label} (R=${curve.R.toPrecision(3)} Ω, Q=${curve.Q.toFixed(2)})`,
        data: freqs.map((f, j) => ({ x: f, y: curve.admittance[j] })),
        borderColor: CURVE_COLORS[i],
        backgroundColor: CURVE_COLORS[i],
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0,
      })),
    }),
    [freqs, curves]
  );

  const options: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "nearest", intersect: false, axis: "x" },
      scales: {
        x: {
          type: "logarithmic",
          title: { display: true, text: "Frequency [Hz] (log scale)", color: AXIS_TEXT_COLOR },
          grid: { color: GRID_COLOR },
          ticks: { color: AXIS_TEXT_COLOR },
        },
        y: {
          type: "logarithmic",
          title: { display: true, text: "Admittance |Y| = 1/|Z| (log scale)", color: AXIS_TEXT_COLOR },
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
          callbacks: {
            title: (items) => `f = ${(items[0].parsed.x as number).toFixed(2)} Hz`,
            label: (ctx) => `${ctx.dataset.label}: ${(ctx.parsed.y as number).toExponential(3)}`,
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
      },
    }),
    [f0]
  );

  return (
    <div style={{ height: 420, width: "100%" }}>
      <Line data={data} options={options} />
    </div>
  );
}
