import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Fullstack Starter",
  description: "Production-ready AI full-stack monorepo",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, padding: 0, background: "#0f0f0f", color: "#f0f0f0" }}>
        {children}
      </body>
    </html>
  );
}
