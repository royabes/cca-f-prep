"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { load } from "@/lib/store";
import { CORPUS } from "@/lib/content";
import { computeReadiness, type Readiness } from "@/lib/readiness";
import { dueCards } from "@/lib/srs";
import { DOMAINS, DOMAIN_MAP, EXAM } from "@/lib/domains";
import { ScoreRing, Bar, Badge, Stat } from "@/components/ui";
import type { DomainKey } from "@/lib/types";

const TIER_TONE: Record<string, "red" | "amber" | "blue" | "green"> = {
  "Not ready": "red",
  Building: "amber",
  Borderline: "amber",
  "Likely pass": "blue",
  "Highly likely": "green",
};

export default function Dashboard() {
  const [r, setR] = useState<Readiness | null>(null);
  const [due, setDue] = useState(0);

  useEffect(() => {
    const s = load();
    setR(computeReadiness(s.answers, s.exams, CORPUS, Date.now()));
    setDue(dueCards(s.srs, Date.now()).length);
  }, []);

  if (!r) {
    return <div className="py-20 text-center text-[var(--ink-faint)]">Loading your progress…</div>;
  }

  const fresh = r.totalAnswered === 0;
  const ringColor =
    r.readinessScaled >= EXAM.passScaled ? "var(--green)" : r.readinessScaled >= 650 ? "var(--amber)" : "var(--clay)";

  return (
    <div className="fade-in">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[var(--clay)]">
            {EXAM.code} · Exam Readiness
          </div>
          <h1 className="text-[2.1rem] leading-tight">
            {fresh ? "Let’s get you certified." : `You’re ${Math.round(r.passProbability * 100)}% likely to pass.`}
          </h1>
          <p className="mt-2 max-w-xl text-[0.95rem] leading-relaxed text-[var(--ink-soft)]">
            {fresh
              ? "Start with a diagnostic mock exam or drill a domain. Your readiness score, weak-area prescriptions, and spaced-repetition queue build automatically as you practice."
              : "Readiness blends your domain mastery with your recent mock-exam scores — the single best predictor of passing."}
          </p>
        </div>
        {r.examReady && (
          <div className="rounded-2xl border border-[var(--green)] bg-[color-mix(in_srgb,var(--green)_8%,transparent)] px-5 py-3 text-center">
            <div className="text-[0.7rem] font-semibold uppercase tracking-wider text-[var(--green)]">
              Consistency gate cleared
            </div>
            <div className="text-lg font-bold">You’re exam-ready ✓</div>
          </div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Readiness card */}
        <div className="card flex flex-col items-center p-6 lg:col-span-1">
          <ScoreRing value={r.readinessScaled} max={EXAM.scaleMax} color={ringColor} label="readiness" />
          <div className="mt-4 flex items-center gap-2">
            <Badge tone={TIER_TONE[r.tier]}>{r.tier}</Badge>
            <span className="text-[0.82rem] text-[var(--ink-soft)]">pass line {EXAM.passScaled}</span>
          </div>
          <div className="mt-4 w-full">
            <div className="mb-1 flex justify-between text-[0.78rem] text-[var(--ink-soft)]">
              <span>Predicted pass probability</span>
              <span className="font-semibold tabular-nums">{Math.round(r.passProbability * 100)}%</span>
            </div>
            <Bar value={r.passProbability * 100} color={ringColor} />
          </div>
          <Link href="/exam" className="btn btn-primary mt-5 w-full">
            {r.totalAnswered === 0 ? "Take diagnostic exam" : "Take a mock exam"}
          </Link>
        </div>

        {/* Domain mastery */}
        <div className="card p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg">Domain mastery</h2>
            <span className="text-[0.78rem] text-[var(--ink-faint)]">weighted by exam blueprint</span>
          </div>
          <div className="grid gap-3.5">
            {r.perDomain.map((d) => {
              const meta = DOMAIN_MAP[d.key as DomainKey];
              return (
                <div key={d.key}>
                  <div className="mb-1 flex items-center gap-2 text-[0.86rem]">
                    <Link href={`/practice?d=${d.key}`} className="font-medium hover:text-[var(--clay-deep)]">
                      {meta.title}
                    </Link>
                    <span className="chip ml-1">{d.weight}%</span>
                    {d.misinformedFrac > 0.12 && d.attempts >= 4 && <Badge tone="red">danger</Badge>}
                    <span className="ml-auto tabular-nums font-semibold">{d.mastery}</span>
                    <span className="text-[var(--ink-faint)]">/100</span>
                  </div>
                  <Bar value={d.mastery} color={meta.accent} />
                  <div className="mt-1 text-[0.72rem] text-[var(--ink-faint)]">
                    {d.attempts === 0
                      ? "not yet practiced"
                      : `${d.attempts} answered · ${Math.round(d.coverage * 100)}% of bank seen`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Prescriptions + quick stats */}
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-2">
          <h2 className="mb-1 text-lg">Your study plan</h2>
          <p className="mb-4 text-[0.84rem] text-[var(--ink-soft)]">
            Prescribed from your weakest, highest-weight, and over-confident areas — fix these first.
          </p>
          <div className="grid gap-2.5">
            {r.prescriptions.length === 0 && (
              <div className="rounded-xl bg-[var(--paper-2)] px-4 py-3 text-[0.88rem] text-[var(--ink-soft)]">
                No prescriptions yet — answer a few questions and your personalized plan appears here.
              </div>
            )}
            {r.prescriptions.map((p, i) => (
              <Link
                key={i}
                href={p.href}
                className="group flex items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--card)] px-4 py-3 transition-colors hover:border-[var(--line-strong)] hover:bg-[var(--paper-2)]"
              >
                <span
                  className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-sm"
                  style={{
                    background:
                      p.kind === "danger"
                        ? "color-mix(in srgb, var(--red) 14%, transparent)"
                        : "var(--clay-soft)",
                  }}
                >
                  {p.kind === "danger" ? "⚠" : p.kind === "take-exam" ? "▶" : "→"}
                </span>
                <span>
                  <span className="block font-semibold text-[0.92rem] group-hover:text-[var(--clay-deep)]">
                    {p.title}
                  </span>
                  <span className="block text-[0.82rem] text-[var(--ink-soft)]">{p.detail}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className="grid content-start gap-4">
          <Stat label="Questions answered" value={r.totalAnswered} sub={`${CORPUS.questions.length} in the bank`} />
          <Link href="/review" className="block">
            <div className="card-flat px-4 py-3 transition-colors hover:bg-[var(--paper-2)]">
              <div className="text-[0.7rem] uppercase tracking-wider text-[var(--ink-faint)]">Due for review</div>
              <div className="mt-0.5 flex items-end gap-2">
                <span className="text-2xl font-bold tabular-nums" style={{ fontFamily: "Georgia, serif" }}>
                  {due}
                </span>
                <span className="mb-1 text-[0.8rem] text-[var(--clay-deep)]">cards →</span>
              </div>
            </div>
          </Link>
          <Stat
            label="Weighted mastery"
            value={`${Math.round(r.weightedMastery)}/100`}
            sub={`projects to ${r.predictedScaled} scaled`}
          />
        </div>
      </div>

      {/* Exam blueprint */}
      <div className="mt-5 card p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg">The exam at a glance</h2>
          <div className="flex flex-wrap gap-2 text-[0.8rem] text-[var(--ink-soft)]">
            <span className="chip">{EXAM.questionCount} questions</span>
            <span className="chip">{EXAM.minutes} min</span>
            <span className="chip">closed-book</span>
            <span className="chip">pass ≥ {EXAM.passScaled}/1000</span>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-5">
          {DOMAINS.map((d) => (
            <Link
              key={d.key}
              href={`/study?d=${d.key}`}
              className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-3 transition-colors hover:bg-[var(--paper-2)]"
            >
              <div className="mb-1 h-1.5 w-8 rounded-full" style={{ background: d.accent }} />
              <div className="text-2xl font-bold" style={{ fontFamily: "Georgia, serif" }}>
                {d.weight}%
              </div>
              <div className="text-[0.8rem] font-medium leading-tight">{d.short}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
