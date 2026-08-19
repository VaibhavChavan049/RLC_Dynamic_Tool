"use client";

import { useEffect, useState, type RefObject } from "react";

// Native Fullscreen API rather than a CSS overlay -- the browser handles
// Escape-to-exit for free. Shared by every chart's Fullscreen button
// (RlcChart, RComparisonChart, CurrentComparisonChart).
export function useFullscreenToggle(containerRef: RefObject<HTMLElement | null>) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  // document.fullscreenEnabled reflects this exact document's Permissions
  // Policy -- false when, say, an embedding page's <iframe> is missing
  // allow="fullscreen". Checking it upfront means the caller can just not
  // render the button at all in that case, rather than showing a visitor
  // a button that does nothing (or an error message) when clicked --
  // neither looks good on an embedded, customer-facing page.
  const [fullscreenSupported, setFullscreenSupported] = useState(true);

  useEffect(() => {
    setFullscreenSupported(document.fullscreenEnabled);
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [containerRef]);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
      return;
    }
    containerRef.current?.requestFullscreen().catch(() => {});
  }

  return { isFullscreen, fullscreenSupported, toggleFullscreen };
}
