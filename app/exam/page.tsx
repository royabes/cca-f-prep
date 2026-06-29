"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSettings } from "@/components/Providers";
import { CORPUS } from "@/lib/content";
import { DOMAIN_MAP, DOMAINS, EXAM } from "@/lib/domains";
import { buildExam, scoreExam, makeExamResult, type ScoredExam } from "@/lib/exam";
import { recordAnswers, recordExam, upsertSrs, load } from "@/lib/store";
import { newCard, review } from "@/lib/srs";
import QuestionCard from "@/components/QuestionCard";
import { ScoreRing, Bar } from "@/components/ui";
import type { Question, AnswerRecord, DomainKey } from "@/lib/types";

type Phase = "intro" | "running" | "results";
type Choice = "A" | "B" | "C" | "D" | null;

function fmt(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export default function ExamPage() {
  const { settings } = useSettings();
  const [phase, setPhase] = useState<Phase>("intro");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, Choice>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [cur, setCur] = useState(0);
  const [remaining, setRemaining] = useState(settings.examMinutes * 60 * 1000);
  const [scored, setScored] = useState<ScoredExam | null>(null);
  const startRef = useRef(0);
  const durationMsRef = useRef(settings.examMinutes * 60 * 1000);

  // Countdown timer.
  useEffect(() => {
    if (phase !== "running") return;
    const id = setInterval(() => {
      const left = durationMsRef.current - (Date.now() - startRef.current);
      if (left <= 0) {
        setRemaining(0);
        finish();
      } else {
        setRemaining(left);
      }
    }, 500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function begin() {
    const qs = buildExam(CORPUS, EXAM.questionCount);
    setQuestions(qs);
    setAnswers({});
    setFlags({});
    setCur(0);
    durationRef(settings.examMinutes);
    startRef.current = Date.now();
    setRemaining(settings.examMinutes * 60 * 1000);
    setPhase("running");
  }

  function durationRef(min: number) {
    durationMsRef.current = min * 60 * 1000;
  }

  function finish() {
    setPhase((p) => {
      if (p !== "running") return p; // guard against double-fire from timer
      const now = Date.now();
      const sc = scoreExam(questions, answers);
      setScored(sc);

      // Record each question as a retrieval event + schedule misses for review.
      const recs: AnswerRecord[] = [];
      const cards = [];
      const state = load();
      for (const q of questions) {
        const chosen = answers[q.id] ?? null;
        const correct = chosen === q.correctOptionId;
        recs.push({
          questionId: q.id,
          domainKey: q.domainKey,
          chosenOptionId: chosen,
          correct,
          confidence: 1,
          difficulty: q.difficulty,
          ts: now,
          mode: "exam",
        });
        const key = `q:${q.id}`;
        const existing = state.srs[key] ?? newCard(key, "question", q.id, q.domainKey, now);
        cards.push(review(existing, correct ? "good" : "again", now));
      }
      recordAnswers(recs);
      upsertSrs(cards);
      recordExam(makeExamResult(sc, now - startRef.current, now));
      return "results";
    });
  }

  // ---------- INTRO ----------
  if (phase === "intro") {
    return (
      <div className="fade-in mx-auto max-w-2xl">
        <div className="mb-1 text-center text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[var(--clay)]">
          Mock exam simulator
        </div>
        <h1 className="text-center text-[2.1rem] leading-tight">Full {EXAM.code} mock exam</h1>
        <p className="mx-auto mt-3 max-w-xl text-center text-[0.95rem] leading-relaxed text-[var(--ink-soft)]">
          Mirrors the real exam: {EXAM.questionCount} scenario-based questions drawn across the five domains by
          blueprint weight, {settings.examMinutes} minutes, no feedback until you submit. Your score is scaled
          {" "}
          {EXAM.scaleMin}–{EXAM.scaleMax}; you pass at {EXAM.passScaled}.
        </p>

        <div className="card mt-6 grid gap-3 p-6 sm:grid-cols-2">
          {DOMAINS.map((d) => (
            <div key={d.key} className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full" style={{ background: d.accent }} />
              <span className="text-[0.88rem]">{d.title}</span>
              <span className="ml-auto chip">{d.weight}%</span>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-center">
          <button onClick={begin} className="btn btn-primary px-8 py-3 text-base">
            Begin exam · {settings.examMinutes}:00
          </button>
        </div>
        <p className="mt-3 text-center text-[0.78rem] text-[var(--ink-faint)]">
          Tip: simulate real conditions — no notes, no tab-switching. Your recent mock scores drive your
          readiness prediction.
        </p>
      </div>
    );
  }

  // ---------- RESULTS ----------
  if (phase === "results" && scored) {
    const passed = scored.passed;
    const missed = questions.filter((q) => answers[q.id] !== q.correctOptionId);
    return (
      <div className="fade-in">
        <div className="card overflow-hidden">
          <div
            className="px-6 py-5 text-center"
            style={{
              background: passed
                ? "color-mix(in srgb, var(--green) 12%, transparent)"
                : "color-mix(in srgb, var(--red) 10%, transparent)",
            }}
          >
            <div className="text-[0.72rem] font-semibold uppercase tracking-[0.16em]" style={{ color: passed ? "var(--green)" : "var(--red)" }}>
              {passed ? "Pass" : "Not yet"}
            </div>
            <h1 className="text-[1.7rem]">{passed ? "You passed the mock." : "Below the line — keep going."}</h1>
          </div>
          <div className="grid items-center gap-6 p-6 sm:grid-cols-[auto_1fr]">
            <div className="mx-auto">
              <ScoreRing
                value={scored.scaledScore}
                max={EXAM.scaleMax}
                color={passed ? "var(--green)" : "var(--red)"}
                label={`/ ${EXAM.scaleMax}`}
                sublabel={`pass ${EXAM.passScaled}`}
              />
            </div>
            <div className="grid gap-3">
              <div className="flex gap-3">
                <div className="card-flat flex-1 px-4 py-2.5">
                  <div className="text-[0.7rem] uppercase tracking-wider text-[var(--ink-faint)]">Raw score</div>
                  <div className="text-xl font-bold tabular-nums">
                    {scored.rawCorrect}/{scored.total}
                  </div>
                </div>
                <div className="card-flat flex-1 px-4 py-2.5">
                  <div className="text-[0.7rem] uppercase tracking-wider text-[var(--ink-faint)]">Time used</div>
                  <div className="text-xl font-bold tabular-nums">
                    {fmt(settings.examMinutes * 60 * 1000 - remaining)}
                  </div>
                </div>
              </div>
              {(Object.keys(scored.perDomain) as DomainKey[]).map((k) => {
                const v = scored.perDomain[k];
                const meta = DOMAIN_MAP[k];
                return (
                  <div key={k} className="flex items-center gap-3">
                    <span className="w-36 shrink-0 text-[0.84rem]">{meta.short}</span>
                    <div className="flex-1">
                      <Bar value={v.correct} max={Math.max(1, v.total)} color={meta.accent} />
                    </div>
                    <span className="w-12 text-right text-[0.82rem] tabular-nums text-[var(--ink-soft)]">
                      {v.correct}/{v.total}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button onClick={() => setPhase("intro")} className="btn btn-primary">
            Retake exam
          </button>
          <Link href="/" className="btn btn-ghost">
            Back to dashboard
          </Link>
          <Link href="/review" className="btn btn-ghost">
            Review missed cards ({missed.length})
          </Link>
        </div>

        {missed.length > 0 && (
          <div className="mt-6">
            <h2 className="mb-3 text-lg">Review your {missed.length} misses</h2>
            <div className="grid gap-4">
              {missed.map((q, i) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  index={i}
                  total={missed.length}
                  selected={answers[q.id] ?? null}
                  confidence={1}
                  revealed
                  onSelect={() => {}}
                  onConfidence={() => {}}
                  showConfidence={false}
                  level={settings.level}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------- RUNNING ----------
  const q = questions[cur];
  const answeredCount = Object.values(answers).filter(Boolean).length;
  const low = remaining < 5 * 60 * 1000;

  return (
    <div className="fade-in">
      <div className="sticky top-[57px] z-30 -mx-5 mb-5 border-b border-[var(--line)] bg-[var(--paper)]/90 px-5 py-2.5 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className={`text-lg font-bold tabular-nums ${low ? "text-[var(--red)]" : ""}`} style={{ fontFamily: "Georgia, serif" }}>
            {fmt(remaining)}
          </span>
          <div className="flex-1">
            <Bar value={answeredCount} max={questions.length} color="var(--clay)" />
          </div>
          <span className="text-[0.8rem] tabular-nums text-[var(--ink-soft)]">
            {answeredCount}/{questions.length}
          </span>
          <button onClick={finish} className="btn btn-primary py-1.5 text-[0.84rem]">
            Submit
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_220px]">
        <div>
          <QuestionCard
            question={q}
            index={cur}
            total={questions.length}
            selected={answers[q.id] ?? null}
            confidence={1}
            revealed={false}
            onSelect={(id) => setAnswers((a) => ({ ...a, [q.id]: id }))}
            onConfidence={() => {}}
            showConfidence={false}
            level={settings.level}
          />
          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              className="btn btn-ghost"
              disabled={cur === 0}
              onClick={() => setCur((c) => Math.max(0, c - 1))}
            >
              ← Prev
            </button>
            <button
              onClick={() => setFlags((f) => ({ ...f, [q.id]: !f[q.id] }))}
              className={`btn ${flags[q.id] ? "btn-soft" : "btn-ghost"}`}
            >
              {flags[q.id] ? "★ Flagged" : "☆ Flag"}
            </button>
            <button
              className="btn btn-ghost"
              disabled={cur === questions.length - 1}
              onClick={() => setCur((c) => Math.min(questions.length - 1, c + 1))}
            >
              Next →
            </button>
          </div>
        </div>

        <div className="card h-fit p-4">
          <div className="mb-2 text-[0.7rem] uppercase tracking-wider text-[var(--ink-faint)]">Navigator</div>
          <div className="grid grid-cols-6 gap-1.5 lg:grid-cols-5">
            {questions.map((qq, i) => {
              const answered = !!answers[qq.id];
              const flagged = flags[qq.id];
              const active = i === cur;
              return (
                <button
                  key={qq.id}
                  onClick={() => setCur(i)}
                  className="relative grid h-8 place-items-center rounded-md border text-[0.74rem] font-semibold tabular-nums transition-colors"
                  style={{
                    borderColor: active ? "var(--clay)" : answered ? "var(--clay)" : "var(--line-strong)",
                    background: answered ? "var(--clay-soft)" : "transparent",
                    color: answered ? "var(--clay-deep)" : "var(--ink-soft)",
                    outline: active ? "2px solid var(--clay)" : "none",
                  }}
                >
                  {i + 1}
                  {flagged && (
                    <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-[var(--amber)]" />
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[0.72rem] text-[var(--ink-faint)]">
            <span className="h-3 w-3 rounded-sm bg-[var(--clay-soft)]" /> answered
            <span className="ml-2 h-1.5 w-1.5 rounded-full bg-[var(--amber)]" /> flagged
          </div>
        </div>
      </div>
    </div>
  );
}
