import { Diamond, Github } from "lucide-react";
import { DEMOS_URL, PORTFOLIO_URL, REPO_URL } from "@/lib/site";

export default function Footer() {
  return (
    <footer className="mt-10 border-t border-[var(--line)] bg-[var(--card)]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-4 px-5 py-8 text-[0.8rem] text-[var(--ink-soft)]">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <a
            href={PORTFOLIO_URL}
            className="flex items-center gap-2 font-semibold text-[var(--ink)] transition-colors hover:text-[var(--clay)]"
          >
            <Diamond className="h-4 w-4 text-[var(--clay)]" />
            Roy Abes
          </a>
          <a href={DEMOS_URL} className="link-underline">
            More demos
          </a>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="link-underline inline-flex items-center gap-1.5"
          >
            <Github className="h-3.5 w-3.5" />
            Source on GitHub
          </a>
        </div>
        <p className="max-w-xl text-[0.74rem] leading-relaxed text-[var(--ink-faint)]">
          CCA-F Trainer is an independent study aid, not affiliated with or endorsed by Anthropic.
          Built around the published exam guide and evidence-based learning science. Your progress
          stays in this browser.
        </p>
      </div>
    </footer>
  );
}
