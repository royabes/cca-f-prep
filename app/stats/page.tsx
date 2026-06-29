"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { load, resetAll } from "@/lib/store";
import { CORPUS } from "@/lib/content";
import { computeReadiness, type Readiness } from "@/lib/readiness";
import { DOMAIN_MAP, EXAM } from "@/lib/domains";
import { PageHeader, Bar, Stat, Badge } from "@/components/ui";
import type { PersistedState, DomainKey } from "@/lib/types";

interface TopicStat {
  topic: string;
  domainKey: DomainKey;
  correct: number;
  total: number;
}

export default function StatsPage() {
  const [state, setState] = useState<PersistedState | null>(null);
  const [r, setR] = useState<Readiness | null>(null);

  function refresh() {
    const s = load();
    setState(s);
    setR(computeReadiness(s.answers, s.exams, CORPUS, Date.now()));
  }
  useEffect(() => {
    refresh();
  }, []);

  if (!state || !r) return <div className="py-20 text-center text-[var(--ink-faint)]">Loading…</div>;

  const totalCorrect = state.answers.filter((a) => a.correct).length;
  const accuracy = state.answers.length ? Math.round((totalCorrect / state.answers.length) * 100) : 0;
  const lastExam = [...state.exams].sort((a, b) => b.ts - a.ts)[0];
  const bestExam = [...state.exams].sort((a, b) => b.scaledScore - a.scaledScore)[0];

  // Weakest topics (min 2 attempts).
  const topicMap = new Map<string, TopicStat>();
  for (const a of state.answers) {
    const q = CORPUS.questions.find((x) => x.id === a.questionId);
    const topic = q?.topic ?? "—";
    const key = `${a.domainKey}::${topic}`;
    const t = topicMap.get(key) ?? { topic, domainKey: a.domainKey, correct: 0, total: 0 };
    t.total++;
    if (a.correct) t.correct++;
    topicMap.set(key, t);
  }
  const weakTopics = [...topicMap.values()]
    .filter((t) => t.total >= 2)
    .sort((a, b) => a.correct / a.total - b.correct / b.total)
    .slice(0, 6);

  return (
    <div className="fade-in">
      <PageHeader
        kicker="Your data"
        title="Progress & calibration"
        intro="The numbers behind your readiness — accuracy, how well-calibrated your confidence is, where you're weakest, and your mock-exam history."
        right={
          <button
            className="btn btn-ghost"
            onClick={() => {
              if (confirm("Reset all progress, answers, exams and spaced-repetition data? This cannot be undone.")) {
                resetAll();
                refresh();
              }
            }}
          >
            Reset progress
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Questions answered" value={state.answers.length} sub={`${accuracy}% correct`} />
        <Stat label="Mock exams" value={state.exams.length} sub={lastExam ? `last ${lastExam.scaledScore}` : "none yet"} />
        <Stat label="Best scaled score" value={bestExam ? bestExam.scaledScore : "—"} sub={`pass ${EXAM.passScaled}`} />
        <Stat label="Readiness" value={r.readinessScaled} sub={r.tier} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {/* Confidence calibration */}
        <div className="card p-6">
          <h2 className="text-lg">Confidence calibration</h2>
          <p className="mb-4 mt-1 text-[0.84rem] text-[var(--ink-soft)]">
            Well-calibrated learners are accurate when confident and unsure when guessing. Being{" "}
            <strong>confident but wrong</strong> is the dangerous zone — you’d trust a wrong answer in the exam.
          </p>
          <div className="grid gap-4">
            {r.calibration.map((c) => {
              const pct = Math.round(c.accuracy * 100);
              const danger = c.confidence === 2 && c.n >= 4 && c.accuracy < 0.7;
              const good = c.confidence === 2 && c.accuracy >= 0.8;
              return (
                <div key={c.confidence}>
                  <div className="mb-1 flex items-center gap-2 text-[0.86rem]">
                    <span className="font-medium">{c.label}</span>
                    {danger && <Badge tone="red">miscalibrated</Badge>}
                    {good && <Badge tone="green">well-calibrated</Badge>}
                    <span className="ml-auto tabular-nums text-[var(--ink-soft)]">
                      {pct}% · {c.n} answers
                    </span>
                  </div>
                  <Bar value={pct} color={danger ? "var(--red)" : good ? "var(--green)" : "var(--amber)"} />
                </div>
              );
            })}
            {state.answers.length === 0 && (
              <p className="text-[0.86rem] text-[var(--ink-faint)]">No data yet — answer some questions.</p>
            )}
          </div>
        </div>

        {/* Per-domain table */}
        <div className="card p-6">
          <h2 className="mb-3 text-lg">By domain</h2>
          <div className="grid gap-3">
            {r.perDomain.map((d) => {
              const meta = DOMAIN_MAP[d.key as DomainKey];
              return (
                <div key={d.key} className="text-[0.86rem]">
                  <div className="mb-1 flex items-center gap-2">
                    <Link href={`/practice?d=${d.key}`} className="font-medium hover:text-[var(--clay-deep)]">
                      {meta.short}
                    </Link>
                    {d.misinformedFrac > 0.12 && d.attempts >= 4 && <Badge tone="red">danger</Badge>}
                    <span className="ml-auto tabular-nums text-[var(--ink-soft)]">
                      {d.attempts > 0 ? `${Math.round(d.rawAccuracy * 100)}% acc` : "—"}
                    </span>
                  </div>
                  <Bar value={d.mastery} color={meta.accent} />
                  <div className="mt-0.5 text-[0.72rem] text-[var(--ink-faint)]">
                    mastery {d.mastery}/100 · {Math.round(d.coverage * 100)}% of bank seen · {d.attempts} answered
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {/* Weakest topics */}
        <div className="card p-6">
          <h2 className="mb-3 text-lg">Weakest topics</h2>
          {weakTopics.length === 0 ? (
            <p className="text-[0.86rem] text-[var(--ink-faint)]">Answer more questions to surface weak topics.</p>
          ) : (
            <div className="grid gap-2.5">
              {weakTopics.map((t) => (
                <div key={t.topic} className="flex items-center gap-3 text-[0.86rem]">
                  <span className="chip" style={{ color: DOMAIN_MAP[t.domainKey].accent, borderColor: DOMAIN_MAP[t.domainKey].accent }}>
                    {DOMAIN_MAP[t.domainKey].short}
                  </span>
                  <span className="flex-1 truncate">{t.topic}</span>
                  <span className="tabular-nums text-[var(--ink-soft)]">
                    {t.correct}/{t.total}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Exam history */}
        <div className="card p-6">
          <h2 className="mb-3 text-lg">Mock-exam history</h2>
          {state.exams.length === 0 ? (
            <p className="text-[0.86rem] text-[var(--ink-faint)]">
              No mock exams yet.{" "}
              <Link href="/exam" className="link-underline text-[var(--clay-deep)]">
                Take one
              </Link>
              .
            </p>
          ) : (
            <div className="grid gap-2">
              {[...state.exams]
                .sort((a, b) => b.ts - a.ts)
                .slice(0, 8)
                .map((e) => (
                  <div key={e.id} className="flex items-center gap-3 rounded-lg bg-[var(--paper-2)] px-3 py-2 text-[0.86rem]">
                    <span className="tabular-nums font-semibold" style={{ color: e.passed ? "var(--green)" : "var(--red)" }}>
                      {e.scaledScore}
                    </span>
                    <span className="text-[var(--ink-soft)]">
                      {e.rawCorrect}/{e.total}
                    </span>
                    {e.passed ? <Badge tone="green">pass</Badge> : <Badge tone="red">fail</Badge>}
                    <span className="ml-auto text-[0.78rem] text-[var(--ink-faint)]">
                      {new Date(e.ts).toLocaleDateString()}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
