import { describe, it, expect } from "vitest";
import { interleaveByDomain, selectAdaptive } from "./adaptive";
import { mulberry32 } from "./rng";
import type { Question, DomainKey, Corpus } from "./types";

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
  it("is deterministic for a given seed and returns `count` questions", () => {
    const corpus: Corpus = {
      lessons: [],
      flashcards: [],
      questions: Array.from({ length: 60 }, (_, i) =>
        mkQ(`q${i}`, (["agentic", "claudecode", "prompt", "tools", "context"] as DomainKey[])[i % 5]),
      ),
    };
    const opts = { count: 10, level: "practitioner" as const, answers: [], srs: {}, now: 1000 };
    const a = selectAdaptive(corpus, { ...opts, rng: mulberry32(7) }).map((q) => q.id);
    const b = selectAdaptive(corpus, { ...opts, rng: mulberry32(7) }).map((q) => q.id);
    expect(a).toEqual(b);
    expect(a.length).toBe(10);
  });
});
