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
import { bandwidth, type RComparisonCurve } from "@/lib/rlc";
import styles from "./ChartToolbar.module.css";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const BAR_COLORS = ["#1863dc", "#e5484d", "#2f9e58", "#f5a623", "#8b5cf6", "#00aeef"];
const AXIS_TEXT_COLOR = "#8a8f98";
const GRID_COLOR = "rgba(128, 128, 128, 0.15)";

type Metric = "Q" | "R" | "BW";

const METRIC_LABEL: Record<Metric, string> = {
  Q: "Quality factor Q",
  R: "R (Ω)",
  BW: "Bandwidth BW (Hz)",
};

const METRIC_UNIT: Record<Metric, string> = {
  Q: "",
  R: " Ω",
  BW: " Hz",
};

interface Props {
  curves: RComparisonCurve[];
  f0: number;
}

/**
 * Q, R, and Bandwidth (BW = f0/Q) are each a single number per R (none vary
 * with frequency), so they can't be frequency-sweep lines like the other
 * charts -- a bar per R value in the comparison list is the natural way to
 * see them side by side. A toggle switches the bars between the three
 * metrics (never combined on one axis -- Ohms, unitless, and Hz mixed
 * together would be misleading).
 */
export default function QualityFactorChart({ curves, f0 }: Props) {
  const [metric, setMetric] = useState<Metric>("Q");

  function valueFor(curve: RComparisonCurve): number {
    if (metric === "Q") return curve.Q;
    if (metric === "R") return curve.R;
    return bandwidth(f0, curve.Q);
  }

  const data = useMemo(
    () => ({
      labels: curves.map((c) => `R = ${c.R.toPrecision(3)} Ω`),
      datasets: [
        {
          label: METRIC_LABEL[metric],
          data: curves.map((c) => valueFor(c)),
          backgroundColor: curves.map((_, i) => BAR_COLORS[i % BAR_COLORS.length]),
          borderRadius: 4,
        },
      ],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [curves, metric, f0]
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
          title: { display: true, text: METRIC_LABEL[metric], color: AXIS_TEXT_COLOR },
          ticks: { color: AXIS_TEXT_COLOR },
          grid: { color: GRID_COLOR },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.label}: ${(ctx.parsed.y as number).toFixed(3)}${METRIC_UNIT[metric]}`,
          },
        },
      },
    }),
    [metric]
  );

  return (
    <div>
      <div className={styles.chartTitle}>Quality Factor, R, and Bandwidth Comparison</div>
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
        <label>
          <input type="radio" checked={metric === "BW"} onChange={() => setMetric("BW")} />
          Bandwidth BW
        </label>
      </div>
      <div style={{ height: 280, width: "100%" }}>
        <Bar data={data} options={options} />
      </div>
    </div>
  );
}
