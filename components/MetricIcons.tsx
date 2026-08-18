// One small line-art icon per metric card, kept in a shared stroke style
// (currentColor, 1.8 stroke) so they inherit each card's accent color and
// stay visually consistent as a set rather than looking like icons pulled
// from five different places.
type IconProps = { size?: number; className?: string };

const shared = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function FrequencyIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...shared}>
      <path d="M2 12c1.5-4.5 3-4.5 4.5 0s3 4.5 4.5 0 3-4.5 4.5 0 3 4.5 4.5 0" />
    </svg>
  );
}

export function ImpedanceIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...shared}>
      <path d="M2 12h3l1.5-4 3 8 3-8 3 8 1.5-4h3" />
    </svg>
  );
}

export function AngularFrequencyIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...shared}>
      <circle cx="12" cy="12" r="7.5" />
      <path d="M12 4.5 L15 3 M12 4.5 L13.6 7.3" />
    </svg>
  );
}

export function QualityFactorIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...shared}>
      <path d="M2 18c4.5 0 5.5-14 10-14s5.5 14 10 14" />
    </svg>
  );
}

export function BandwidthIcon({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...shared}>
      <path d="M7 5v14M17 5v14" />
      <path d="M9 12h6M9.5 9l-2.5 3 2.5 3M14.5 9l2.5 3-2.5 3" />
    </svg>
  );
}
