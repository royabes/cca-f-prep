import { describe, it, expect } from "vitest";
import { interleaveByDomain, selectAdaptive } from "./adaptive";
import { mulberry32 } from "./rng";
import type { Question, DomainKey, Corpus, AnswerRecord } from "./types";

function mkQ(id: string, domainKey: DomainKey): Question {
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

describe("interleaveByDomain", () => {
  it("shuffles questions within a domain using the injected rng", () => {
    const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const qs = ids.map((id) => mkQ(id, "agentic"));
    const out = interleaveByDomain(qs, mulberry32(99)).map((q) => q.id);
    // Regression guard: the old code discarded shuffle()'s return value, so a
    // single-domain list came back in original order. After the fix it must differ.
    expect(out).not.toEqual(ids);
    expect([...out].sort()).toEqual([...ids].sort()); // no questions lost
  });

  it("is deterministic for a given seed", () => {
    const qs = ["a", "b", "c", "d", "e"].map((id) => mkQ(id, "tools"));
    const a = interleaveByDomain(qs, mulberry32(3)).map((q) => q.id);
    const b = interleaveByDomain(qs, mulberry32(3)).map((q) => q.id);
    expect(a).toEqual(b);
  });

  it("round-robins across domains rather than grouping them", () => {
    const qs = [
      mkQ("x1", "agentic"),
      mkQ("x2", "agentic"),
      mkQ("y1", "context"),
      mkQ("y2", "context"),
    ];
    const out = interleaveByDomain(qs, mulberry32(1));
    // first two questions come from different domains
    expect(out[0].domainKey).not.toEqual(out[1].domainKey);
  });
});

describe("selectAdaptive", () => {
  const fullCorpus: Corpus = {
    lessons: [],
    flashcards: [],
    questions: Array.from({ length: 60 }, (_, i) =>
      mkQ(`q${i}`, (["agentic", "claudecode", "prompt", "tools", "context"] as DomainKey[])[i % 5]),
    ),
  };

  it("is deterministic for a given seed and returns `count` questions", () => {
    const opts = { count: 10, level: "practitioner" as const, answers: [], srs: {}, now: 1000 };
    const a = selectAdaptive(fullCorpus, { ...opts, rng: mulberry32(7) }).map((q) => q.id);
    const b = selectAdaptive(fullCorpus, { ...opts, rng: mulberry32(7) }).map((q) => q.id);
    expect(a).toEqual(b);
    expect(a.length).toBe(10);
  });

  it("returns exactly `count` questions even for small sessions", () => {
    for (const count of [1, 2, 3, 4]) {
      const sel = selectAdaptive(fullCorpus, { count, level: "practitioner", answers: [], srs: {}, now: 1000, rng: mulberry32(count) });
      expect(sel.length).toBe(count);
    }
  });

  it("a small session targets the WEAKEST domains, not just the first ones in blueprint order", () => {
    // Make agentic/claudecode/prompt strong (high recent accuracy => low weakness),
    // leaving tools & context as the weakest (no history => assumed weak).
    const strong: AnswerRecord[] = [];
    let t = 1000;
    for (const d of ["agentic", "claudecode", "prompt"] as DomainKey[]) {
      for (let i = 0; i < 8; i++) {
        strong.push({ questionId: `seen-${d}-${i}`, domainKey: d, chosenOptionId: "A", correct: true, confidence: 2, difficulty: "medium", ts: t++, mode: "practice" });
      }
    }
    const sel = selectAdaptive(fullCorpus, { count: 2, level: "practitioner", answers: strong, srs: {}, now: t + 1, rng: mulberry32(3) });
    expect(sel.length).toBe(2);
    // Regression: the old max(1)-per-domain allocation + slice(0,count) always
    // emitted agentic/claudecode first; now the two slots go to the weakest domains.
    const domains = new Set(sel.map((q) => q.domainKey));
    expect([...domains].every((d) => d === "tools" || d === "context")).toBe(true);
  });
});
