import { ArrowUpRight } from "lucide-react";
import { WHATS_NEW } from "@/lib/whats-new";

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function WhatsNew() {
  const latest = WHATS_NEW.slice(0, 3);
  if (latest.length === 0) return null;
  return (
    <section className="card mb-6 p-5" aria-labelledby="whats-new-heading">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="whats-new-heading" className="text-lg">
          What’s new
        </h2>
        <span className="chip">Updated {formatDate(latest[0].date)}</span>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {latest.map((e) => (
          <article key={e.date + e.title} className="card-flat flex flex-col p-4">
            <div className="mono text-[0.68rem] uppercase tracking-wider text-[var(--ink-faint)]">
              {formatDate(e.date)}
            </div>
            <h3 className="mt-1 text-[0.98rem] font-semibold leading-snug">{e.title}</h3>
            <p className="mt-1.5 text-[0.86rem] leading-relaxed text-[var(--ink-soft)]">{e.body}</p>
            {e.href && (
              <a
                href={e.href}
                target={e.href.startsWith("http") ? "_blank" : undefined}
                rel={e.href.startsWith("http") ? "noopener noreferrer" : undefined}
                className="mt-3 inline-flex items-center gap-1 text-[0.84rem] font-medium text-[var(--clay)] hover:underline"
              >
                {e.label}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
