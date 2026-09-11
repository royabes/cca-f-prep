"use client";

import React from "react";
import type { Question, Confidence, UserLevel } from "@/lib/types";
import { DOMAIN_MAP } from "@/lib/domains";
import { Badge } from "./ui";
import ExplainPanel from "./ExplainPanel";

const CONF_LABELS: { v: Confidence; label: string }[] = [
  { v: 0, label: "Guessing" },
  { v: 1, label: "Fairly sure" },
  { v: 2, label: "Confident" },
];

export default function QuestionCard({
  question,
  index,
  total,
  selected,
  confidence,
  revealed,
  onSelect,
  onConfidence,
  showConfidence = true,
  level,
}: {
  question: Question;
  index: number;
  total: number;
  selected: "A" | "B" | "C" | "D" | null;
  confidence: Confidence;
  revealed: boolean;
  onSelect: (id: "A" | "B" | "C" | "D") => void;
  onConfidence: (c: Confidence) => void;
  showConfidence?: boolean;
  level: UserLevel;
}) {
  const dm = DOMAIN_MAP[question.domainKey];
  const correctId = question.correctOptionId;
  const wasRight = selected === correctId;

  return (
    <div className="card fade-in p-6 sm:p-7">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="chip" style={{ color: dm.accent, borderColor: dm.accent }}>
          {dm.short}
        </span>
        <span className="chip">{question.topic}</span>
        <span className="chip">{question.difficulty}</span>
        <span className="ml-auto text-[0.78rem] font-medium text-[var(--ink-faint)]">
          {index + 1} / {total}
        </span>
      </div>

      {question.scenario && (
        <div
          className="mb-4 rounded-xl border-l-[3px] bg-[var(--paper-2)] px-4 py-3 text-[0.9rem] leading-relaxed text-[var(--ink-soft)]"
          style={{ borderColor: dm.accent }}
        >
          <span className="mr-1 font-semibold uppercase tracking-wide text-[0.68rem] text-[var(--ink-faint)]">
            Scenario ·
          </span>
          {question.scenario}
        </div>
      )}

      <p className="mb-5 text-[1.06rem] font-semibold leading-snug">{question.stem}</p>

      <div className="grid gap-2.5">
        {question.options.map((o) => {
          const isSelected = selected === o.id;
          const isCorrect = o.id === correctId;
          let cls = "border-[var(--line-strong)] bg-[var(--card)] hover:bg-[var(--paper-2)]";
          if (revealed) {
            if (isCorrect) cls = "border-[var(--green)] bg-[color-mix(in_srgb,var(--green)_10%,transparent)]";
            else if (isSelected) cls = "border-[var(--red)] bg-[color-mix(in_srgb,var(--red)_10%,transparent)]";
            else cls = "border-[var(--line)] opacity-70";
          } else if (isSelected) {
            cls = "border-[var(--clay)] bg-[var(--clay-soft)]";
          }
          return (
            <button
              key={o.id}
              disabled={revealed}
              onClick={() => onSelect(o.id)}
              className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left text-[0.93rem] transition-colors ${cls} ${
                revealed ? "cursor-default" : "cursor-pointer"
              }`}
            >
              <span
                className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border text-[0.78rem] font-bold"
                style={{
                  borderColor: revealed && isCorrect ? "var(--green)" : isSelected ? "var(--clay)" : "var(--line-strong)",
                  color: revealed && isCorrect ? "var(--green)" : isSelected ? "var(--clay-deep)" : "var(--ink-soft)",
                }}
              >
                {revealed && isCorrect ? "✓" : revealed && isSelected ? "✗" : o.id}
              </span>
              <span>{o.text}</span>
            </button>
          );
        })}
      </div>

      {showConfidence && !revealed && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="text-[0.78rem] font-medium text-[var(--ink-faint)]">How sure are you?</span>
          {CONF_LABELS.map((c) => (
            <button
              key={c.v}
              onClick={() => onConfidence(c.v)}
              className={`rounded-lg border px-3 py-1.5 text-[0.8rem] font-medium transition-colors ${
                confidence === c.v
                  ? "border-[var(--clay)] bg-[var(--clay-soft)] text-[var(--clay-deep)]"
                  : "border-[var(--line-strong)] text-[var(--ink-soft)] hover:bg-[var(--paper-2)]"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {revealed && (
        <div className="fade-in mt-5">
          <div className="mb-3 flex items-center gap-2">
            {wasRight ? (
              <Badge tone="green">Correct</Badge>
            ) : selected ? (
              <Badge tone="red">{confidence === 2 ? "Confident, but wrong" : "Not quite"}</Badge>
            ) : (
              <Badge tone="amber">Skipped</Badge>
            )}
            {!wasRight && (
              <span className="text-[0.84rem] text-[var(--ink-soft)]">
                Correct answer: <strong>{correctId}</strong>
              </span>
            )}
          </div>
          <div className="rounded-xl bg-[var(--paper-2)] px-4 py-3 text-[0.9rem] leading-relaxed">
            <span className="font-semibold text-[var(--clay-deep)]">Why: </span>
            {question.explanation}
          </div>
          <ExplainPanel question={question} level={level} />
        </div>
      )}
    </div>
  );
}
