"use client";

import { useState } from "react";
import styles from "@/app/page.module.css";

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminKey, newPassword }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setStatus({ ok: true, message: "Password updated. It's live immediately, no need to tell anyone to refresh." });
        setNewPassword("");
      } else {
        setStatus({ ok: false, message: data.message ?? "Something went wrong." });
      }
    } catch {
      setStatus({ ok: false, message: "Network error -- please try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.page}>
      <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 700 }}>Change the site password</h1>
          <p style={{ marginTop: "0.4rem", color: "var(--muted)", fontSize: "0.9rem" }}>
            This is the password visitors enter on the calculator&apos;s lock screen. Changing it here takes effect
            immediately for everyone -- no code, no redeploy.
          </p>
        </div>

        <div className={styles.panel}>
          <div className={styles.field}>
            <label htmlFor="admin-key">Admin key</label>
            <input
              id="admin-key"
              className={styles.input}
              type="password"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              placeholder="Your admin key"
              autoComplete="off"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="new-password">New site password</label>
            <input
              id="new-password"
              className={styles.input}
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password for visitors"
              autoComplete="off"
            />
          </div>
          <button
            type="button"
            className={styles.addButton}
            onClick={handleSave}
            disabled={saving || !adminKey || newPassword.trim().length < 4}
          >
            {saving ? "Saving..." : "Save new password"}
          </button>
          {status && (
            <p style={{ fontSize: "0.85rem", color: status.ok ? "#2f9e58" : "#e5484d" }}>{status.message}</p>
          )}
        </div>
      </div>
    </div>
  );
}
