import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RLC Resonant Frequency Calculator",
  description: "Series RLC tank Xc/XL resonance chart -- enter L, C, R and see the resonant frequency instantly.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
