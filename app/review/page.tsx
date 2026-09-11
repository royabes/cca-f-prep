"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSettings } from "@/components/Providers";
import { CORPUS, QUESTION_BY_ID } from "@/lib/content";
import { DOMAIN_MAP } from "@/lib/domains";
import { load, upsertSrs } from "@/lib/store";
import { dueCards, newCard, review, type Recall } from "@/lib/srs";
import PracticeSession from "@/components/PracticeSession";
import { PageHeader, Badge } from "@/components/ui";
import type { Question, Flashcard } from "@/lib/types";

const GRADES: { r: Recall; label: string; tone: string }[] = [
  { r: "again", label: "Again", tone: "var(--red)" },
  { r: "hard", label: "Hard", tone: "var(--amber)" },
  { r: "good", label: "Good", tone: "var(--blue)" },
  { r: "easy", label: "Easy", tone: "var(--green)" },
];

function FlashcardReview({ cards, onDone }: { cards: Flashcard[]; onDone: () => void }) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  if (idx >= cards.length) {
    return (
      <div className="card mx-auto max-w-lg p-7 text-center">
        <div className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[var(--clay)]">Done</div>
        <h2 className="my-2 text-2xl">Flashcards reviewed</h2>
        <p className="text-[var(--ink-soft)]">{cards.length} cards rescheduled by spaced repetition.</p>
        <button className="btn btn-primary mt-5" onClick={onDone}>
          Back to review
        </button>
      </div>
    );
  }

  const card = cards[idx];
  const meta = DOMAIN_MAP[card.domainKey];

  function grade(r: Recall) {
    const now = Date.now();
    const key = `f:${card.id}`;
    const existing = load().srs[key] ?? newCard(key, "flashcard", card.id, card.domainKey, now);
    upsertSrs([review(existing, r, now)]);
    setFlipped(false);
    setIdx((i) => i + 1);
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-3 text-center text-[0.8rem] text-[var(--ink-faint)]">
        {idx + 1} / {cards.length}
      </div>
      <div className="card min-h-[220px] p-7">
        <span className="chip" style={{ color: meta.accent, borderColor: meta.accent }}>
          {meta.short}
        </span>
        <div className="mt-5 text-[1.15rem] font-semibold leading-snug">{card.front}</div>
        {flipped && (
          <div className="fade-in mt-4 border-t border-[var(--line)] pt-4 text-[0.98rem] leading-relaxed text-[var(--ink-soft)]">
            {card.back}
          </div>
        )}
      </div>
      {!flipped ? (
        <button className="btn btn-ghost mt-4 w-full" onClick={() => setFlipped(true)}>
          Reveal answer
        </button>
      ) : (
        <div className="mt-4 grid grid-cols-4 gap-2">
          {GRADES.map((g) => (
            <button
              key={g.r}
              onClick={() => grade(g.r)}
              className="rounded-xl border py-2.5 text-[0.84rem] font-semibold transition-transform active:translate-y-px"
              style={{ borderColor: g.tone, color: g.tone }}
            >
              {g.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ReviewPage() {
  const { settings } = useSettings();
  const [mode, setMode] = useState<"menu" | "questions" | "flashcards">("menu");
  const [dueQ, setDueQ] = useState<Question[]>([]);
  const [dueF, setDueF] = useState<Flashcard[]>([]);
  const [newF, setNewF] = useState<Flashcard[]>([]);

  function refresh() {
    const s = load();
    const now = Date.now();
    const due = dueCards(s.srs, now);
    const qs = due
      .filter((c) => c.kind === "question")
      .map((c) => QUESTION_BY_ID.get(c.refId))
      .filter((q): q is Question => !!q);
    const fs = due
      .filter((c) => c.kind === "flashcard")
      .map((c) => CORPUS.flashcards.find((f) => f.id === c.refId))
      .filter((f): f is Flashcard => !!f);
    const fresh = CORPUS.flashcards.filter((f) => !s.srs[`f:${f.id}`]);
    setDueQ(qs);
    setDueF(fs);
    setNewF(fresh);
  }

  useEffect(() => {
    refresh();
  }, []);

  if (mode === "questions" && dueQ.length > 0) {
    return (
      <PracticeSession
        questions={dueQ}
        mode="review"
        level={settings.level}
        onExit={() => {
          refresh();
          setMode("menu");
        }}
      />
    );
  }

  if (mode === "flashcards") {
    const deck = [...dueF, ...newF].slice(0, 20);
    return (
      <FlashcardReview
        cards={deck}
        onDone={() => {
          refresh();
          setMode("menu");
        }}
      />
    );
  }

  const flashTotal = dueF.length + Math.min(newF.length, 20);

  return (
    <div className="fade-in">
      <PageHeader
        kicker="Spaced repetition"
        title="Review what’s due"
        intro="Spaced repetition spreads recall over time so memories consolidate and stop fading. Questions you miss and shaky flashcards resurface here exactly when you’re about to forget them."
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="card flex flex-col p-6">
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-lg">Questions due</h2>
            {dueQ.length > 0 && <Badge tone="clay">{dueQ.length}</Badge>}
          </div>
          <p className="flex-1 text-[0.86rem] text-[var(--ink-soft)]">
            Previously-missed or low-confidence questions scheduled by the SM-2 algorithm. Re-answer them under
            recall conditions.
          </p>
          <button
            className="btn btn-primary mt-4"
            disabled={dueQ.length === 0}
            onClick={() => setMode("questions")}
          >
            {dueQ.length === 0 ? "Nothing due, all caught up ✓" : `Review ${dueQ.length} questions`}
          </button>
        </div>

        <div className="card flex flex-col p-6">
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-lg">Flashcards</h2>
            {flashTotal > 0 && <Badge tone="clay">{flashTotal}</Badge>}
          </div>
          <p className="flex-1 text-[0.86rem] text-[var(--ink-soft)]">
            {dueF.length} due · {newF.length} new. Quick term/concept recall with self-graded confidence
            (Again / Hard / Good / Easy).
          </p>
          <button
            className="btn btn-primary mt-4"
            disabled={flashTotal === 0}
            onClick={() => setMode("flashcards")}
          >
            {flashTotal === 0 ? "All flashcards reviewed ✓" : `Review ${Math.min(flashTotal, 20)} flashcards`}
          </button>
        </div>
      </div>

      {dueQ.length === 0 && flashTotal === 0 && (
        <div className="mt-5 card p-6 text-center text-[var(--ink-soft)]">
          You’re fully caught up. New cards are created as you practice and take exams, {" "}
          <Link href="/practice" className="link-underline text-[var(--clay-deep)]">
            drill a domain
          </Link>{" "}
          to feed the queue.
        </div>
      )}
    </div>
  );
}
