"use client";

import { useState } from "react";
import type { Question, Confidence, UserLevel, AnswerRecord } from "@/lib/types";
import { DOMAIN_MAP } from "@/lib/domains";
import { recordAnswers, upsertSrs, load } from "@/lib/store";
import { newCard, review, type Recall } from "@/lib/srs";
import QuestionCard from "./QuestionCard";
import { Bar, Badge } from "./ui";

function recallFor(correct: boolean, confidence: Confidence): Recall {
  if (!correct) return "again";
  if (confidence === 2) return "easy";
  if (confidence === 1) return "good";
  return "hard";
}

export default function PracticeSession({
  questions,
  mode,
  level,
  onExit,
}: {
  questions: Question[];
  mode: "practice" | "review";
  level: UserLevel;
  onExit?: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<"A" | "B" | "C" | "D" | null>(null);
  const [confidence, setConfidence] = useState<Confidence>(1);
  const [revealed, setRevealed] = useState(false);
  const [outcomes, setOutcomes] = useState<{ q: Question; correct: boolean; confidence: Confidence }[]>([]);

  const q = questions[idx];
  const done = idx >= questions.length;

  const correctCount = outcomes.filter((o) => o.correct).length;

  function submit() {
    if (!selected || revealed) return;
    const correct = selected === q.correctOptionId;
    const now = Date.now();

    const rec: AnswerRecord = {
      questionId: q.id,
      domainKey: q.domainKey,
      chosenOptionId: selected,
      correct,
      confidence,
      difficulty: q.difficulty,
      ts: now,
      mode,
    };
    recordAnswers([rec]);

    // Spaced-repetition update for this question.
    const key = `q:${q.id}`;
    const existing = load().srs[key];
    const card = existing ?? newCard(key, "question", q.id, q.domainKey, now);
    upsertSrs([review(card, recallFor(correct, confidence), now)]);

    setOutcomes((o) => [...o, { q, correct, confidence }]);
    setRevealed(true);
  }

  function next() {
    setSelected(null);
    setConfidence(1);
    setRevealed(false);
    setIdx((i) => i + 1);
  }

  if (done) {
    const pct = questions.length ? Math.round((correctCount / questions.length) * 100) : 0;
    const confidentWrong = outcomes.filter((o) => !o.correct && o.confidence === 2);
    const byDomain = new Map<string, { c: number; t: number }>();
    for (const o of outcomes) {
      const d = byDomain.get(o.q.domainKey) || { c: 0, t: 0 };
      d.t++;
      if (o.correct) d.c++;
      byDomain.set(o.q.domainKey, d);
    }
    return (
      <div className="card fade-in mx-auto max-w-2xl p-7 text-center">
        <div className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[var(--clay)]">
          Session complete
        </div>
        <div className="my-3 text-6xl font-bold" style={{ fontFamily: "Georgia, serif" }}>
          {pct}%
        </div>
        <p className="text-[var(--ink-soft)]">
          {correctCount} / {questions.length} correct
        </p>

        <div className="mt-6 grid gap-3 text-left">
          {[...byDomain.entries()].map(([k, v]) => (
            <div key={k} className="flex items-center gap-3">
              <span className="w-36 shrink-0 text-[0.84rem] font-medium">{DOMAIN_MAP[k as keyof typeof DOMAIN_MAP]?.short ?? k}</span>
              <div className="flex-1">
                <Bar value={v.c} max={v.t} color={DOMAIN_MAP[k as keyof typeof DOMAIN_MAP]?.accent} />
              </div>
              <span className="w-12 text-right text-[0.82rem] tabular-nums text-[var(--ink-soft)]">
                {v.c}/{v.t}
              </span>
            </div>
          ))}
        </div>

        {confidentWrong.length > 0 && (
          <div className="mt-6 rounded-xl border border-[var(--red)] bg-[color-mix(in_srgb,var(--red)_7%,transparent)] px-4 py-3 text-left text-[0.86rem]">
            <div className="mb-1 flex items-center gap-2">
              <Badge tone="red">Danger zone</Badge>
              <span className="font-semibold">{confidentWrong.length} confident-but-wrong</span>
            </div>
            These are your highest-risk gaps: you believed a wrong answer. Re-read the relevant lesson, then
            re-drill that domain. They’ve been queued for spaced review.
          </div>
        )}

        <div className="mt-6 flex justify-center gap-2">
          <button className="btn btn-primary" onClick={() => onExit?.()}>
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex-1">
          <Bar value={idx + (revealed ? 1 : 0)} max={questions.length} />
        </div>
        <span className="text-[0.8rem] font-medium tabular-nums text-[var(--ink-soft)]">
          {correctCount} correct
        </span>
      </div>

      <QuestionCard
        question={q}
        index={idx}
        total={questions.length}
        selected={selected}
        confidence={confidence}
        revealed={revealed}
        onSelect={setSelected}
        onConfidence={setConfidence}
        level={level}
      />

      <div className="mt-4 flex justify-end gap-2">
        {!revealed ? (
          <button className="btn btn-primary" disabled={!selected} onClick={submit}>
            Submit answer
          </button>
        ) : (
          <button className="btn btn-primary" onClick={next}>
            {idx + 1 >= questions.length ? "See results" : "Next question →"}
          </button>
        )}
      </div>
    </div>
  );
}
