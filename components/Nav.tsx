"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSettings } from "./Providers";
import { LEVELS } from "@/lib/domains";
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
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--paper)]/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--clay)] font-bold text-white">
            C
          </span>
          <span className="leading-tight">
            <span className="block text-[0.95rem] font-bold tracking-tight">CCA-F Trainer</span>
            <span className="block text-[0.66rem] uppercase tracking-wider text-[var(--ink-faint)]">
              Claude Certified Architect
            </span>
          </span>
        </Link>

        <nav className="order-3 flex w-full flex-wrap items-center gap-1 sm:order-2 sm:w-auto">
          {LINKS.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-1.5 text-[0.86rem] font-medium transition-colors ${
                  active
                    ? "bg-[var(--clay-soft)] text-[var(--clay-deep)]"
                    : "text-[var(--ink-soft)] hover:bg-[var(--paper-2)] hover:text-[var(--ink)]"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="order-2 ml-auto flex items-center gap-2 sm:order-3">
          <label className="text-[0.7rem] uppercase tracking-wider text-[var(--ink-faint)]">
            Level
          </label>
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
        </div>
      </div>
    </header>
  );
}
