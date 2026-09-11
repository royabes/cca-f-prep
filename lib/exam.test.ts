import { describe, it, expect } from "vitest";
import { shuffle, domainQuota, scaledFromRaw, scoreExam, buildExam } from "./exam";
import { mulberry32 } from "./rng";
import { EXAM } from "./domains";
import type { Question, DomainKey, Corpus } from "./types";

function mkQ(id: string, domainKey: DomainKey, correct: "A" | "B" | "C" | "D" = "A"): Question {
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
    correctOptionId: correct,
    explanation: "e",
  };
}

describe("shuffle with injected rng", () => {
  it("is deterministic for a given seed", () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const out1 = shuffle(arr, mulberry32(123));
    const out2 = shuffle(arr, mulberry32(123));
    expect(out1).toEqual(out2);
  });

  it("actually permutes (not the identity) for this seed", () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(shuffle(arr, mulberry32(123))).not.toEqual(arr);
  });

  it("preserves all elements and does not mutate the input", () => {
    const arr = [1, 2, 3, 4, 5];
    const out = shuffle(arr, mulberry32(9));
    expect([...out].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
    expect(arr).toEqual([1, 2, 3, 4, 5]);
  });
});

// Characterization tests: lock the verified scoring math so the debias
// migration provably cannot change pass/fail behavior.
describe("scaledFromRaw (existing behavior)", () => {
  it("maps 0 to scaleMin and a perfect score to scaleMax", () => {
    expect(scaledFromRaw(0)).toBe(EXAM.scaleMin);
    expect(scaledFromRaw(1)).toBe(EXAM.scaleMax);
  });
  it("places the 720 pass line at 42/60 (pass) and 41/60 (fail)", () => {
    expect(scaledFromRaw(42 / 60)).toBeGreaterThanOrEqual(EXAM.passScaled);
    expect(scaledFromRaw(41 / 60)).toBeLessThan(EXAM.passScaled);
  });
});

describe("domainQuota (existing behavior)", () => {
  it("apportions exactly `count` across domains by blueprint weight", () => {
    const q = domainQuota(60);
    const total = Object.values(q).reduce((s, n) => s + n, 0);
    expect(total).toBe(60);
    expect(q.agentic).toBe(16);
    expect(q.context).toBe(9);
  });
});

describe("scoreExam (existing behavior)", () => {
  it("counts correct answers against correctOptionId and scales", () => {
    const qs: Question[] = [mkQ("a", "agentic", "A"), mkQ("b", "tools", "C")];
    const scored = scoreExam(qs, { a: "A", b: "B" });
    expect(scored.rawCorrect).toBe(1);
    expect(scored.total).toBe(2);
    expect(scored.perDomain.agentic).toEqual({ correct: 1, total: 1 });
    expect(scored.perDomain.tools).toEqual({ correct: 0, total: 1 });
  });
});

describe("buildExam with injected rng", () => {
  it("is deterministic for a given seed and returns `count` questions", () => {
    const corpus: Corpus = {
      lessons: [],
      flashcards: [],
      questions: Array.from({ length: 80 }, (_, i) =>
        mkQ(`q${i}`, (["agentic", "claudecode", "prompt", "tools", "context"] as DomainKey[])[i % 5]),
      ),
    };
    const a = buildExam(corpus, 60, mulberry32(5)).map((q) => q.id);
    const b = buildExam(corpus, 60, mulberry32(5)).map((q) => q.id);
    expect(a).toEqual(b);
    expect(a.length).toBe(60);
  });
});
