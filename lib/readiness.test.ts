import { describe, it, expect } from "vitest";
import { computeReadiness } from "./readiness";
import type { AnswerRecord, Corpus, Question, Confidence, DomainKey } from "./types";

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

describe("computeReadiness — exam answers don't pollute confidence metrics", () => {
  // 4 practice answers (all confidence=Confident): 2 wrong, 2 right.
  // 10 exam answers (forced confidence=1, all correct) — should NOT touch confidence stats.
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
