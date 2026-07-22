"use client";

import { useRef, useState, useSyncExternalStore } from "react";

// Change this to set a new password. Casual gate only, not real security --
// anyone reading the JS bundle can find this value, and that's fine for a
// demo/pitch link where the goal is just "don't show a random visitor the app".
const CORRECT_PASSWORD = "drf2024";

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
  const inputRef = useRef<HTMLInputElement>(null);

  function tryUnlock() {
    if (password === CORRECT_PASSWORD) {
      sessionStorage.setItem(STORAGE_KEY, "true");
      window.location.reload();
    } else {
      setError(true);
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
          <button onClick={tryUnlock} style={styles.button}>
            Enter
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "#0b0f16",
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
    color: "#ffffff",
    fontSize: "1.1rem",
    fontWeight: 700,
    letterSpacing: "0.02em",
  },
  subtitle: {
    color: "#9aa3b5",
    fontSize: "0.85rem",
    marginBottom: "0.5rem",
  },
  input: {
    width: "100%",
    padding: "0.65rem 0.8rem",
    borderRadius: 8,
    border: "1px solid #223047",
    background: "#131a24",
    color: "#ededee",
    fontSize: "0.95rem",
    outline: "none",
    boxSizing: "border-box",
  },
  error: {
    color: "#f87171",
    fontSize: "0.8rem",
  },
  button: {
    width: "100%",
    boxSizing: "border-box",
    padding: "0.65rem 0.8rem",
    borderRadius: 8,
    border: "none",
    background: "#1863dc",
    color: "#ffffff",
    fontSize: "0.95rem",
    fontWeight: 600,
    cursor: "pointer",
  },
};
