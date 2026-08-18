import type { Chart, TooltipModel } from "chart.js";

export interface TooltipReadout {
  title: string;
  rows: { color: string; text: string }[];
}

// Chart.js's built-in tooltip renders right at the hovered point, covering
// it up -- especially bad on the sharp V/peak curves these charts draw,
// where the point you're trying to read is exactly what disappears. This
// builds an `external` tooltip callback that instead pushes the same
// title/rows Chart.js would have shown into a plain callback, so the
// caller can render them in a fixed spot of its own layout (never over the
// data) instead of letting Chart.js draw its floating tooltip.
export function makeTooltipHandler(onChange: (readout: TooltipReadout | null) => void) {
  return (context: { chart: Chart; tooltip: TooltipModel<"line"> }) => {
    const { tooltip } = context;
    if (tooltip.opacity === 0 || !tooltip.body?.length) {
      onChange(null);
      return;
    }
    onChange({
      title: tooltip.title?.[0] ?? "",
      rows: tooltip.body.map((b, i) => ({
        color: (tooltip.labelColors[i]?.borderColor as string) ?? "#8a8f98",
        text: b.lines.join(" "),
      })),
    });
  };
}
