// Small line-art icons for the chart toolbars (Zoom in/out, Reset zoom,
// Zoom to bandwidth, Fullscreen, Download CSV) -- same stroke-based style
// as MetricIcons.tsx, sized to sit inside a compact square IconButton
// instead of a full text-label button.
type IconProps = { size?: number };

const shared = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function ZoomInIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...shared}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M10.5 7.5v6M7.5 10.5h6" />
      <path d="M20 20l-4.8-4.8" />
    </svg>
  );
}

export function ZoomOutIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...shared}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M7.5 10.5h6" />
      <path d="M20 20l-4.8-4.8" />
    </svg>
  );
}

export function ResetZoomIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...shared}>
      <path d="M4 12a8 8 0 1 1 2.6 5.9" />
      <path d="M4 18v-5h5" />
    </svg>
  );
}

export function BandwidthTargetIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...shared}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}

export function FullscreenIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...shared}>
      <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />
    </svg>
  );
}

export function ExitFullscreenIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...shared}>
      <path d="M4 9h5V4M20 9h-5V4M4 15h5v5M20 15h-5v5" />
    </svg>
  );
}

export function DownloadIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...shared}>
      <path d="M12 3v12" />
      <path d="M7.5 10.5 12 15l4.5-4.5" />
      <path d="M4 19h16" />
    </svg>
  );
}
