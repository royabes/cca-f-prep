"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSettings } from "@/components/Providers";
import { DOMAINS, DOMAIN_MAP, LEVELS } from "@/lib/domains";
import { CORPUS } from "@/lib/content";
import { selectAdaptive } from "@/lib/adaptive";
import { load } from "@/lib/store";
import PracticeSession from "@/components/PracticeSession";
import { PageHeader } from "@/components/ui";
import type { DomainKey, Question } from "@/lib/types";

function PracticeInner() {
  const sp = useSearchParams();
  const preDomain = sp.get("d") as DomainKey | null;
  const { settings } = useSettings();

  const [count, setCount] = useState(12);
  const [domain, setDomain] = useState<DomainKey | "all">(
    preDomain && DOMAIN_MAP[preDomain] ? preDomain : "all",
  );
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [sessionKey, setSessionKey] = useState(0);

  function start() {
    const s = load();
    const qs = selectAdaptive(CORPUS, {
      count,
      level: settings.level,
      domain,
      answers: s.answers,
      srs: s.srs,
      now: Date.now(),
    });
    setQuestions(qs);
    setSessionKey((k) => k + 1);
  }

  if (questions && questions.length > 0) {
    return (
      <PracticeSession
        key={sessionKey}
        questions={questions}
        mode="practice"
        level={settings.level}
        onExit={() => setQuestions(null)}
      />
    );
  }

  const levelMeta = LEVELS.find((l) => l.key === settings.level)!;

  return (
    <div className="fade-in">
      <PageHeader
        kicker="Retrieval practice"
        title="Drill with instant feedback"
        intro="Active recall is the highest-yield study technique. Pick a focus, rate your confidence on each question, and get immediate explanations. Misses and shaky answers are auto-queued for spaced repetition."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-2">
          <h2 className="mb-3 text-base">Focus</h2>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <button
              onClick={() => setDomain("all")}
              className={`rounded-xl border p-4 text-left transition-colors ${
                domain === "all"
                  ? "border-[var(--clay)] bg-[var(--clay-soft)]"
                  : "border-[var(--line-strong)] hover:bg-[var(--paper-2)]"
              }`}
            >
              <div className="font-semibold">Adaptive mix ✦</div>
              <div className="text-[0.82rem] text-[var(--ink-soft)]">
                Interleaves all domains, weighted toward your weak and over-confident areas at your level.
              </div>
            </button>
            {DOMAINS.map((d) => (
              <button
                key={d.key}
                onClick={() => setDomain(d.key)}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  domain === d.key
                    ? "border-transparent text-white"
                    : "border-[var(--line-strong)] hover:bg-[var(--paper-2)]"
                }`}
                style={domain === d.key ? { background: d.accent } : undefined}
              >
                <div className="font-semibold">{d.short}</div>
                <div className={`text-[0.82rem] ${domain === d.key ? "text-white/85" : "text-[var(--ink-soft)]"}`}>
                  {d.weight}% of exam · {CORPUS.questions.filter((q) => q.domainKey === d.key).length} questions
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="card content-start grid gap-5 p-6">
          <div>
            <h2 className="mb-2 text-base">Session length</h2>
            <div className="flex gap-2">
              {[8, 12, 20].map((n) => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className={`flex-1 rounded-xl border py-2 text-[0.9rem] font-semibold transition-colors ${
                    count === n
                      ? "border-[var(--clay)] bg-[var(--clay-soft)] text-[var(--clay-deep)]"
                      : "border-[var(--line-strong)] text-[var(--ink-soft)] hover:bg-[var(--paper-2)]"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="mb-1 text-base">Level</h2>
            <p className="text-[0.82rem] text-[var(--ink-soft)]">
              <strong className="text-[var(--ink)]">{levelMeta.label}</strong>, {levelMeta.desc} Change it in the top
              bar; it tunes difficulty and tutor explanations.
            </p>
          </div>

          <button onClick={start} className="btn btn-primary w-full">
            Start {count}-question session
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PracticePage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-[var(--ink-faint)]">Loading…</div>}>
      <PracticeInner />
    </Suspense>
  );
}
