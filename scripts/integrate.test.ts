import { describe, it, expect } from "vitest";
import { assignBalancedTargets, nextIdFor, questionShapeErrors } from "./integrate";
import type { Question } from "../lib/types";

type OptId = "A" | "B" | "C" | "D";

describe("assignBalancedTargets", () => {
  it("fills the under-represented position first to keep the bank balanced", () => {
    const targets = assignBalancedTargets({ A: 33, B: 33, C: 33, D: 32 }, 4);
    expect(targets[0]).toBe("D"); // D is behind, gets the first
    // after assigning, the four positions are within 1 of each other
    const c = { A: 33, B: 33, C: 33, D: 32 };
    for (const t of targets) c[t as OptId]++;
    expect(Math.max(...Object.values(c)) - Math.min(...Object.values(c))).toBeLessThanOrEqual(1);
  });

  it("keeps a large addition near-uniform and is deterministic", () => {
    const a = assignBalancedTargets({ A: 0, B: 0, C: 0, D: 0 }, 40);
    const b = assignBalancedTargets({ A: 0, B: 0, C: 0, D: 0 }, 40);
    expect(a).toEqual(b);
    const c: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
    for (const t of a) c[t]++;
    expect(c).toEqual({ A: 10, B: 10, C: 10, D: 10 });
  });
});

describe("nextIdFor", () => {
  it("returns the next sequential id for a prefix, ignoring other prefixes", () => {
    const ids = ["agentic-q1", "agentic-q14", "support-q3", "tools-q15"];
    expect(nextIdFor(ids, "agentic")).toBe("agentic-q15");
    expect(nextIdFor(ids, "tools")).toBe("tools-q16");
    expect(nextIdFor(ids, "context")).toBe("context-q1");
  });
});

function goodQ(): Question {
  return {
    id: "agentic-q99",
    unitKind: "domain",
    unitKey: "agentic",
    domainKey: "agentic",
    scenarioKey: null,
    topic: "task decomposition",
    difficulty: "medium",
    scenario: "A team needs to…",
    stem: "What is the best approach?",
    options: [
      { id: "A", text: "alpha" },
      { id: "B", text: "bravo" },
      { id: "C", text: "charlie" },
      { id: "D", text: "delta" },
    ],
    correctOptionId: "C",
    explanation: "C is correct because alpha/bravo/delta each fail for a concrete, stated reason that makes the tradeoff clear.",
  };
}

describe("questionShapeErrors", () => {
  it("accepts a well-formed question", () => {
    expect(questionShapeErrors(goodQ())).toEqual([]);
  });

  it("flags options not labeled A,B,C,D in order", () => {
    const q = goodQ();
    q.options = [q.options[1], q.options[0], q.options[2], q.options[3]];
    expect(questionShapeErrors(q).join(" ")).toMatch(/A,B,C,D/);
  });

  it("flags a correctOptionId that is not present", () => {
    const q = goodQ();
    (q as { correctOptionId: string }).correctOptionId = "E";
    expect(questionShapeErrors(q).length).toBeGreaterThan(0);
  });

  it("flags an invalid domainKey, a too-short explanation, and a blank option", () => {
    const q = goodQ();
    (q as { domainKey: string }).domainKey = "nope";
    q.explanation = "too short";
    q.options[2].text = "  ";
    const errs = questionShapeErrors(q);
    expect(errs.length).toBeGreaterThanOrEqual(3);
  });

  it("flags unitKind/scenarioKey inconsistency", () => {
    const q = goodQ();
    q.unitKind = "scenario"; // but scenarioKey is null
    expect(questionShapeErrors(q).join(" ")).toMatch(/scenario/i);
  });
});
