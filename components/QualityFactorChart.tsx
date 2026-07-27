"use client";

import { useMemo, useState } from "react";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  type ChartOptions,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import type { RComparisonCurve } from "@/lib/rlc";
import styles from "./ChartToolbar.module.css";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const BAR_COLORS = ["#1863dc", "#e5484d", "#2f9e58", "#f5a623", "#8b5cf6", "#00aeef"];
const AXIS_TEXT_COLOR = "#8a8f98";
const GRID_COLOR = "rgba(128, 128, 128, 0.15)";

interface Props {
  curves: RComparisonCurve[];
}

/**
 * Q is a single number per R (it doesn't vary with frequency), so it can't
 * be a frequency-sweep line like the other charts -- a bar per R value in
 * the comparison list is the natural way to see them side by side. A
 * toggle switches the bars between showing Q and showing R itself (never
 * both on one axis -- R is in Ohms and Q is unitless, mixing them on one
 * scale would be misleading).
 */
export default function QualityFactorChart({ curves }: Props) {
  const [metric, setMetric] = useState<"Q" | "R">("Q");

  const data = useMemo(
    () => ({
      labels: curves.map((c) => `R = ${c.R.toPrecision(3)} Ω`),
      datasets: [
        {
          label: metric === "Q" ? "Quality factor Q" : "R (Ω)",
          data: curves.map((c) => (metric === "Q" ? c.Q : c.R)),
          backgroundColor: curves.map((_, i) => BAR_COLORS[i % BAR_COLORS.length]),
          borderRadius: 4,
        },
      ],
    }),
    [curves, metric]
  );

  const options: ChartOptions<"bar"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        x: {
          ticks: { color: AXIS_TEXT_COLOR },
          grid: { display: false },
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: metric === "Q" ? "Quality factor Q" : "R (Ω)", color: AXIS_TEXT_COLOR },
          ticks: { color: AXIS_TEXT_COLOR },
          grid: { color: GRID_COLOR },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.label}: ${(ctx.parsed.y as number).toFixed(3)}${metric === "R" ? " Ω" : ""}`,
          },
        },
      },
    }),
    [metric]
  );

  return (
    <div>
      <div className={styles.metricToggleRow}>
        <span>Compare by:</span>
        <label>
          <input type="radio" checked={metric === "Q"} onChange={() => setMetric("Q")} />
          Quality factor Q
        </label>
        <label>
          <input type="radio" checked={metric === "R"} onChange={() => setMetric("R")} />
          R value
        </label>
      </div>
      <div style={{ height: 280, width: "100%" }}>
        <Bar data={data} options={options} />
      </div>
    </div>
  );
}
