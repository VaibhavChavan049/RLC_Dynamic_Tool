"use client";

import { useEffect, useState, type RefObject } from "react";

// Native Fullscreen API rather than a CSS overlay -- the browser handles
// Escape-to-exit for free. Shared by every chart's Fullscreen button
// (RlcChart, RComparisonChart, CurrentComparisonChart).
export function useFullscreenToggle(containerRef: RefObject<HTMLElement | null>) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  // A page embedding this app in an <iframe> without `allow="fullscreen"`
  // makes requestFullscreen() reject with a permissions-policy error --
  // without this, the button just silently does nothing, which is
  // indistinguishable from a real bug. Catching it lets the button explain
  // what's actually wrong instead.
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
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
    setBlocked(false);
    containerRef.current?.requestFullscreen().catch(() => setBlocked(true));
  }

  return { isFullscreen, blocked, toggleFullscreen };
}
