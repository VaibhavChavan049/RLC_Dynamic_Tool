"use client";

import styles from "./LogSlider.module.css";

interface Props {
  valueSI: number; // current value in SI base units (Henries, Farads, Ohms, Volts)
  min: number; // SI-unit range the slider covers -- independent of whatever
  max: number; // display unit is currently selected, so switching units
  onChangeSI: (v: number) => void; // doesn't jump the slider around.
}

// log10-mapped 0..1 <-> [min, max] so one slider usefully spans values that
// differ by many orders of magnitude (e.g. 1nH to 10H) -- a linear slider
// over that range would put almost every practical value in the first
// pixel.
function toPosition(value: number, min: number, max: number): number {
  const clamped = Math.max(min, Math.min(max, value || min));
  return (Math.log10(clamped) - Math.log10(min)) / (Math.log10(max) - Math.log10(min));
}

function fromPosition(position: number, min: number, max: number): number {
  const logMin = Math.log10(min);
  const logMax = Math.log10(max);
  return Math.pow(10, logMin + position * (logMax - logMin));
}

export default function LogSlider({ valueSI, min, max, onChangeSI }: Props) {
  return (
    <input
      type="range"
      className={styles.slider}
      min={0}
      max={1}
      step={0.0005}
      value={toPosition(valueSI, min, max)}
      onChange={(e) => onChangeSI(fromPosition(Number(e.target.value), min, max))}
      aria-label="Adjust value (log scale)"
    />
  );
}
