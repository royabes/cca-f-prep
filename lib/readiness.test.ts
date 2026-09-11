import { describe, it, expect } from "vitest";
import { computeReadiness } from "./readiness";
import { newCard } from "./srs";
import type { AnswerRecord, Corpus, Question, Confidence, DomainKey, ExamResult } from "./types";

const DAY = 86_400_000;
function exam(ts: number, scaled: number): ExamResult {
  const perDomain = Object.fromEntries(
    (["agentic", "claudecode", "prompt", "tools", "context"] as DomainKey[]).map((k) => [k, { correct: 0, total: 0 }]),
  ) as ExamResult["perDomain"];
  return { id: `e${ts}`, ts, scaledScore: scaled, passed: scaled >= 720, rawCorrect: 0, total: 60, durationMs: 1000, perDomain };
}

function q(id: string, domainKey: DomainKey): Question {
  return {
    id,
    unitKind: "domain",
    unitKey: domainKey,
    domainKey,
    scenarioKey: null,
    topic: "t",
    difficulty: "medium",
    scenario: null,
    stem: "s",
    options: [
      { id: "A", text: "a" },
      { id: "B", text: "b" },
      { id: "C", text: "c" },
      { id: "D", text: "d" },
    ],
    correctOptionId: "A",
    explanation: "e",
  };
}
const corpus: Corpus = { lessons: [], flashcards: [], questions: Array.from({ length: 8 }, (_, i) => q(`agentic-${i}`, "agentic")) };

function ans(domainKey: DomainKey, correct: boolean, confidence: Confidence, mode: AnswerRecord["mode"], i: number): AnswerRecord {
  return { questionId: `${domainKey}-${i}`, domainKey, chosenOptionId: "A", correct, confidence, difficulty: "medium", ts: 1000 + i, mode };
}

describe("computeReadiness: exam answers don't pollute confidence metrics", () => {
  // 4 practice answers (all confidence=Confident): 2 wrong, 2 right.
  // 10 exam answers (forced confidence=1, all correct): should NOT touch confidence stats.
  const practice: AnswerRecord[] = [
    ans("agentic", false, 2, "practice", 0),
    ans("agentic", false, 2, "practice", 1),
    ans("agentic", true, 2, "practice", 2),
    ans("agentic", true, 2, "practice", 3),
  ];
  const exam: AnswerRecord[] = Array.from({ length: 10 }, (_, i) => ans("agentic", true, 1, "exam", 10 + i));
  const r = computeReadiness([...practice, ...exam], [], corpus, 5000);
  const ag = r.perDomain.find((d) => d.key === "agentic")!;

  it("computes the confident-but-wrong (danger) fraction over RATED answers only", () => {
    // 2 confident-wrong out of 4 rated practice answers = 0.5 (not 2/14 diluted by exam)
    expect(ag.misinformedFrac).toBeCloseTo(0.5, 5);
    expect(ag.masteredFrac).toBeCloseTo(0.5, 5);
  });

  it("still counts exam answers as real attempts (not dropped)", () => {
    expect(ag.attempts).toBe(14);
  });

  it("excludes exam answers from the confidence-calibration buckets", () => {
    const unsure = r.calibration.find((c) => c.confidence === 1)!;
    const confident = r.calibration.find((c) => c.confidence === 2)!;
    expect(unsure.n).toBe(0); // the 10 exam answers (synthetic confidence=1) are excluded
    expect(confident.n).toBe(4); // only the 4 genuinely-rated practice answers
  });
});

describe("computeReadiness, cadence & review prescriptions", () => {
  const now = 100 * DAY;

  it("prescribes clearing the spaced-repetition queue when cards are due", () => {
    const srs = { "q:agentic-0": newCard("q:agentic-0", "question", "agentic-0", "agentic", now - 1000) };
    const r = computeReadiness([], [], corpus, now, srs);
    expect(r.prescriptions.some((p) => p.kind === "review-due")).toBe(true);
  });

  it("prescribes a fresh mock when the last exam is stale and not yet exam-ready", () => {
    const exams = [exam(now - 8 * DAY, 600), exam(now - 9 * DAY, 610)];
    const r = computeReadiness([], exams, corpus, now, {});
    const cadence = r.prescriptions.find((p) => p.kind === "take-exam");
    expect(cadence).toBeTruthy();
    expect(cadence!.detail).toMatch(/day|since/i);
  });

  it("prescribes a diagnostic mock when none have been taken", () => {
    const r = computeReadiness([], [], corpus, now, {});
    const presc = r.prescriptions.find((p) => p.kind === "take-exam");
    expect(presc?.detail).toMatch(/diagnostic/i);
  });

  it("does not nag for a fresh mock right after a recent one", () => {
    const exams = [exam(now - 1 * DAY, 600), exam(now - 2 * DAY, 610)];
    const r = computeReadiness([], exams, corpus, now, {});
    expect(r.prescriptions.some((p) => p.kind === "take-exam")).toBe(false);
  });
});
