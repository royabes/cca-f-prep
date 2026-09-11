"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Diamond } from "lucide-react";
import { useSettings } from "./Providers";
import { ThemeToggle } from "./ThemeToggle";
import { LEVELS } from "@/lib/domains";
import { PORTFOLIO_URL } from "@/lib/site";
import type { UserLevel } from "@/lib/types";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/study", label: "Study" },
  { href: "/practice", label: "Practice" },
  { href: "/exam", label: "Mock Exam" },
  { href: "/review", label: "Review" },
  { href: "/stats", label: "Progress" },
  { href: "/tutor", label: "AI Tutor" },
];

export default function Nav() {
  const pathname = usePathname();
  const { settings, setLevel } = useSettings();

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--card)]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-5 py-2.5 lg:min-h-16 lg:flex-nowrap">
        {/* Wordmark: back to the portfolio, then this app */}
        <div className="flex items-center gap-3">
          <a
            href={PORTFOLIO_URL}
            className="group flex items-center gap-2"
            title="Back to royabes.com"
          >
            <Diamond className="h-5 w-5 text-[var(--clay)]" />
            <span className="hidden text-[0.95rem] font-semibold text-[var(--ink)] transition-colors group-hover:text-[var(--clay)] xl:inline">
              Roy Abes
            </span>
          </a>
          <span className="h-5 w-px bg-[var(--line-strong)]" aria-hidden />
          <Link href="/" className="leading-tight">
            <span className="font-display block text-[0.95rem] font-bold tracking-tight">CCA-F Trainer</span>
            <span className="hidden text-[0.62rem] uppercase tracking-[0.12em] text-[var(--ink-faint)] xl:block">
              Claude Certified Architect · CCAR-F
            </span>
          </Link>
        </div>

        <nav
          aria-label="Sections"
          className="order-3 -mx-1 flex w-full items-center gap-0.5 overflow-x-auto px-1 lg:order-2 lg:mx-0 lg:min-w-0 lg:flex-1 lg:justify-center lg:overflow-visible lg:px-0"
        >
          {LINKS.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`whitespace-nowrap rounded-lg px-2 py-1.5 text-[0.84rem] font-medium transition-colors ${
                  active
                    ? "bg-[var(--clay-soft)] text-[var(--clay)]"
                    : "text-[var(--ink-soft)] hover:bg-[var(--paper-2)] hover:text-[var(--ink)]"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="order-2 ml-auto flex shrink-0 items-center gap-2 lg:order-3">
          <label className="hidden text-[0.68rem] uppercase tracking-wider text-[var(--ink-faint)] xl:inline">Level</label>
          <select
            value={settings.level}
            onChange={(e) => setLevel(e.target.value as UserLevel)}
            className="rounded-lg border border-[var(--line-strong)] bg-[var(--card)] px-2.5 py-1.5 text-[0.82rem] font-medium text-[var(--ink)] outline-none focus:border-[var(--clay)]"
          >
            {LEVELS.map((lv) => (
              <option key={lv.key} value={lv.key}>
                {lv.label}
              </option>
            ))}
          </select>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
