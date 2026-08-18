import styles from "./ChartToolbar.module.css";
import type { TooltipReadout as TooltipReadoutData } from "@/lib/chartTooltip";

export default function TooltipReadout({
  data,
  placeholder,
}: {
  data: TooltipReadoutData | null;
  placeholder: string;
}) {
  if (!data) {
    return <div className={styles.tooltipReadoutPlaceholder}>{placeholder}</div>;
  }
  return (
    <div className={styles.tooltipReadout}>
      <div className={styles.tooltipReadoutTitle}>{data.title}</div>
      {data.rows.map((row, i) => (
        <div className={styles.tooltipReadoutRow} key={i}>
          <span className={styles.tooltipReadoutSwatch} style={{ background: row.color }} />
          <span>{row.text}</span>
        </div>
      ))}
    </div>
  );
}
