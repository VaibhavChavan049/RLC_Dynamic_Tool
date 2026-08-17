import PasswordGate from "@/components/PasswordGate";

// Scoped to this route group (the main calculator) rather than the root
// layout, so /admin -- where the visitor password itself gets rotated --
// stays reachable even if nobody remembers the current site password.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <PasswordGate>{children}</PasswordGate>;
}
