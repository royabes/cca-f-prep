import { describe, it, expect } from "vitest";
import { CORPUS } from "./content";
import { DOMAINS } from "./domains";
import type { DomainKey } from "./types";

// Guard tests on the SHIPPED question bank — these lock in schema integrity and,
// critically, the debiased answer-key distribution so the 88%-answer-A
// regression can never silently return.
describe("shipped question bank", () => {
  const qs = CORPUS.questions;

  it("has 131 questions with unique ids", () => {
    expect(qs).toHaveLength(131);
    expect(new Set(qs.map((q) => q.id)).size).toBe(131);
  });

  it("every question is schema-valid", () => {
    const domainKeys = new Set(DOMAINS.map((d) => d.key));
    for (const q of qs) {
      expect(q.options.map((o) => o.id)).toEqual(["A", "B", "C", "D"]);
      expect(q.options.every((o) => o.text.trim().length > 0)).toBe(true);
      expect(["A", "B", "C", "D"]).toContain(q.correctOptionId);
      expect(q.options.some((o) => o.id === q.correctOptionId)).toBe(true);
      expect(q.explanation.trim().length).toBeGreaterThan(40);
      expect(domainKeys.has(q.domainKey as DomainKey)).toBe(true);
      expect(["easy", "medium", "hard"]).toContain(q.difficulty);
    }
  });

  it("has a near-uniform correct-answer position (no positional bias to game)", () => {
    const dist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
    for (const q of qs) dist[q.correctOptionId]++;
    const lo = Math.floor(qs.length / 4);
    const hi = Math.ceil(qs.length / 4);
    for (const k of ["A", "B", "C", "D"]) {
      expect(dist[k], `position ${k}=${dist[k]} (expected ${lo}..${hi})`).toBeGreaterThanOrEqual(lo);
      expect(dist[k]).toBeLessThanOrEqual(hi);
    }
    // no single position holds more than ~30% of answers
    expect(Math.max(...Object.values(dist)) / qs.length).toBeLessThan(0.3);
  });

  it("has 50 flashcards and one lesson per domain", () => {
    expect(CORPUS.flashcards).toHaveLength(50);
    expect(CORPUS.lessons).toHaveLength(5);
    expect(new Set(CORPUS.lessons.map((l) => l.domainKey))).toEqual(new Set(DOMAINS.map((d) => d.key)));
  });
});
