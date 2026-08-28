import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SEO Technical Audit Agent",
  description: "AI-assisted technical SEO crawler, audit, and client reporting.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
