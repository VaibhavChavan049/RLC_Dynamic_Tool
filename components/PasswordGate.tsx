"use client";

import { useRef, useState, useSyncExternalStore } from "react";

// Casual gate only, not real security -- the real password check happens
// server-side in app/api/check-password/route.ts against a value stored in
// Edge Config, which app/admin/page.tsx can rotate without a code change or
// redeploy. This component never sees the correct value.
const STORAGE_KEY = "rlc_unlocked";

// useSyncExternalStore is the React-recommended way to read a value that
// lives outside React (here, sessionStorage) without triggering "setState
// in an effect" lint warnings, and it handles server/client hydration
// correctly on its own.
function subscribe() {
  // Unlocking triggers a full page reload (see tryUnlock below), which
  // re-reads the snapshot fresh, so no cross-tab subscription is needed.
  return () => {};
}

function getSnapshot() {
  return sessionStorage.getItem(STORAGE_KEY) === "true";
}

function getServerSnapshot() {
  // sessionStorage doesn't exist on the server, default to locked.
  return false;
}

export default function PasswordGate({ children }: { children: React.ReactNode }) {
  const unlocked = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function tryUnlock() {
    if (!password || checking) return;
    setChecking(true);
    try {
      const res = await fetch("/api/check-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.ok) {
        sessionStorage.setItem(STORAGE_KEY, "true");
        window.location.reload();
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setChecking(false);
    }
  }

  if (!unlocked) {
    return (
      <div style={styles.overlay}>
        <div style={styles.card}>
          <div style={styles.title}>DRF Engineering Services</div>
          <div style={styles.subtitle}>Enter the password to view this preview.</div>
          <input
            ref={inputRef}
            autoFocus
            type="password"
            value={password}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setPassword(e.target.value);
              setError(false);
            }}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === "Enter") tryUnlock();
            }}
            placeholder="Password"
            style={styles.input}
          />
          {error && <div style={styles.error}>Incorrect password, try again.</div>}
          <button onClick={tryUnlock} style={styles.button} disabled={checking}>
            {checking ? "Checking..." : "Enter"}
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// Uses the same --background/--foreground/etc. CSS variables (globals.css)
// as the rest of the app, instead of hardcoded dark-navy hex values -- the
// hardcoded colors used to render this gate as a dark box regardless of the
// app's own (light, DRF-branded) theme, which looked like a broken/foreign
// block when embedded in the company site's white page.
const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "var(--background)",
    zIndex: 9999,
  },
  card: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "calc(100% - 3rem)",
    maxWidth: 340,
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    textAlign: "center",
  },
  title: {
    color: "var(--foreground)",
    fontSize: "1.1rem",
    fontWeight: 700,
    letterSpacing: "0.02em",
  },
  subtitle: {
    color: "var(--muted)",
    fontSize: "0.85rem",
    marginBottom: "0.5rem",
  },
  input: {
    width: "100%",
    padding: "0.65rem 0.8rem",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--foreground)",
    fontSize: "0.95rem",
    outline: "none",
    boxSizing: "border-box",
  },
  error: {
    color: "#e5484d",
    fontSize: "0.8rem",
  },
  button: {
    width: "100%",
    boxSizing: "border-box",
    padding: "0.65rem 0.8rem",
    borderRadius: 8,
    border: "none",
    background: "var(--accent)",
    color: "#ffffff",
    fontSize: "0.95rem",
    fontWeight: 600,
    cursor: "pointer",
  },
};
