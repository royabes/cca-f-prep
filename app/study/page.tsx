"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DOMAINS, DOMAIN_MAP } from "@/lib/domains";
import { LESSON_BY_DOMAIN, flashcardsForDomain, questionsForDomain } from "@/lib/content";
import Markdown from "@/components/Markdown";
import { PageHeader } from "@/components/ui";
import type { DomainKey, Flashcard } from "@/lib/types";

function FlipCard({ card }: { card: Flashcard }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      onClick={() => setFlipped((f) => !f)}
      className="card-flat min-h-[112px] w-full px-4 py-3 text-left transition-colors hover:bg-[var(--paper-2)]"
    >
      <div className="text-[0.66rem] font-semibold uppercase tracking-wider text-[var(--ink-faint)]">
        {flipped ? "Answer" : "Prompt · tap to flip"}
      </div>
      <div className="mt-1 text-[0.92rem] leading-snug">
        {flipped ? <span className="text-[var(--ink-soft)]">{card.back}</span> : <span className="font-medium">{card.front}</span>}
      </div>
    </button>
  );
}

function StudyInner() {
  const sp = useSearchParams();
  const param = sp.get("d") as DomainKey | null;
  const initial: DomainKey = param && DOMAIN_MAP[param] ? param : "agentic";
  const [domain, setDomain] = useState<DomainKey>(initial);

  const lesson = LESSON_BY_DOMAIN.get(domain);
  const cards = flashcardsForDomain(domain);
  const meta = DOMAIN_MAP[domain];

  return (
    <div className="fade-in">
      <PageHeader
        kicker="Study briefs"
        title="Learn each domain"
        intro="Concise, exam-focused briefs grounded in real Anthropic technology. Read the brief, flip the flashcards, then drill the domain to lock it in with retrieval practice."
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {DOMAINS.map((d) => (
          <button
            key={d.key}
            onClick={() => setDomain(d.key)}
            className={`rounded-xl border px-3 py-1.5 text-[0.84rem] font-medium transition-colors ${
              domain === d.key
                ? "border-transparent text-white"
                : "border-[var(--line-strong)] text-[var(--ink-soft)] hover:bg-[var(--paper-2)]"
            }`}
            style={domain === d.key ? { background: d.accent } : undefined}
          >
            {d.short} <span className="opacity-70">· {d.weight}%</span>
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="card p-6 sm:p-7 lg:col-span-2">
          {lesson ? (
            <Markdown source={lesson.markdown} />
          ) : (
            <p className="text-[var(--ink-soft)]">Lesson coming soon.</p>
          )}
          <div className="mt-6 flex flex-wrap gap-2 border-t border-[var(--line)] pt-5">
            <Link href={`/practice?d=${domain}`} className="btn btn-primary">
              Drill {meta.short} ({questionsForDomain(domain).length} Qs)
            </Link>
            <Link href="/review" className="btn btn-ghost">
              Review due cards
            </Link>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base">Flashcards</h2>
            <span className="text-[0.76rem] text-[var(--ink-faint)]">{cards.length} cards</span>
          </div>
          <div className="grid gap-2.5">
            {cards.map((c) => (
              <FlipCard key={c.id} card={c} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StudyPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-[var(--ink-faint)]">Loading…</div>}>
      <StudyInner />
    </Suspense>
  );
}
