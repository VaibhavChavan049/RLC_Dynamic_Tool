"use client";

import { useMemo } from "react";
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
import { Line } from "react-chartjs-2";
import type { ReactancePoints } from "@/lib/rlc";
import { buildLogGraphPaperTicks, logMajorOnlyLabel, logGridColor, logGridWidth } from "@/lib/logAxis";

ChartJS.register(LogarithmicScale, LinearScale, PointElement, LineElement, Tooltip, Legend, annotationPlugin);

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
}

export default function RlcChart({ reactance, f0, logY = false }: Props) {
  const { freqs, xc, xl } = reactance;

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
        y: logY
          ? {
              type: "logarithmic",
              afterBuildTicks: buildLogGraphPaperTicks,
              title: { display: true, text: "Impedance [Ω] (log scale)", color: AXIS_TEXT_COLOR },
              grid: {
                color: (ctx) => logGridColor(ctx, MAJOR_GRID_COLOR, MINOR_GRID_COLOR),
                lineWidth: logGridWidth,
              },
              ticks: { color: AXIS_TEXT_COLOR, callback: logMajorOnlyLabel, autoSkip: false },
            }
          : {
              type: "linear",
              title: { display: true, text: "Impedance [Ω]", color: AXIS_TEXT_COLOR },
              grid: { color: MINOR_GRID_COLOR },
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
      },
    }),
    [f0, logY]
  );

  return (
    <div style={{ height: 420, width: "100%" }}>
      <Line data={data} options={options} />
    </div>
  );
}
