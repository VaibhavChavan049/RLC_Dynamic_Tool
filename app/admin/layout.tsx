import type { Metadata } from "next";

// Not linked from anywhere in the site's nav -- noindex keeps it out of
// search results too, since it's only ever meant to be reached by whoever
// has the direct URL.
export const metadata: Metadata = {
  title: "Admin | DRF Engineering Services",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
