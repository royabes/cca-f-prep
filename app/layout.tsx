import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "CCA-F Trainer: Pass the Claude Certified Architect Exam",
  description:
    "An evidence-based trainer for the Claude Certified Architect - Foundations (CCA-F) exam: study briefs, adaptive practice, a full mock-exam simulator, spaced repetition, and a level-aware AI tutor.",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Nav />
          <main className="mx-auto max-w-6xl px-5 py-7">{children}</main>
          <footer className="mx-auto max-w-6xl px-5 pb-10 pt-4 text-[0.74rem] text-[var(--ink-faint)]">
            CCA-F Trainer · Independent study aid · Not affiliated with or endorsed by Anthropic ·
            Built around the published exam blueprint and evidence-based learning science.
          </footer>
        </Providers>
      </body>
    </html>
  );
}
