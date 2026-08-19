import styles from "./ChartToolbar.module.css";

interface Props {
  icon: React.ReactNode;
  title: string; // tooltip + accessible name -- always required, since the
  // icon alone isn't self-explanatory for app-specific actions like
  // "Zoom to bandwidth".
  label?: string; // optional short visible text next to the icon (e.g. "CSV")
  onClick: () => void;
}

export default function IconButton({ icon, title, label, onClick }: Props) {
  return (
    <button
      type="button"
      className={label ? styles.iconButtonLabeled : styles.iconButton}
      onClick={onClick}
      aria-label={title}
      data-tooltip={title}
    >
      {icon}
      {label && <span>{label}</span>}
    </button>
  );
}
