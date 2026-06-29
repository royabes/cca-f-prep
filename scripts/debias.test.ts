import { describe, it, expect } from "vitest";
import { applyLayout, layoutForTarget, planBalancedPermutations, oldToNewMap, correctDistribution, validateRebalanced, verifyRemap } from "./debias";
import { mulberry32 } from "../lib/rng";
import type { Question } from "../lib/types";

type OptId = "A" | "B" | "C" | "D";

function mkQ(id: string, correct: OptId): Question {
  return {
    id,
    unitKind: "domain",
    unitKey: "agentic",
    domainKey: "agentic",
    scenarioKey: null,
    topic: "t",
    difficulty: "medium",
    scenario: null,
    stem: "s",
    options: (["A", "B", "C", "D"] as OptId[]).map((L) => ({ id: L, text: `${id}-${L}-text` })),
    correctOptionId: correct,
    explanation: "e",
  };
}

const textOf = (q: Question, id: OptId) => q.options.find((o) => o.id === id)!.text;

describe("applyLayout", () => {
  it("returns the question unchanged for the identity order", () => {
    const q = mkQ("q1", "A");
    const out = applyLayout(q, ["A", "B", "C", "D"]);
    expect(out.options).toEqual(q.options);
    expect(out.correctOptionId).toBe("A");
  });

  it("relabels options by their new position and remaps correctOptionId to the moved correct option", () => {
    const q = mkQ("q1", "A"); // correct text = "q1-A-text"
    // newOrder: position A<-old C, B<-old A, C<-old D, D<-old B
    const out = applyLayout(q, ["C", "A", "D", "B"]);
    expect(out.options.map((o) => o.id)).toEqual(["A", "B", "C", "D"]); // always relabeled A..D
    expect(textOf(out, "A")).toBe("q1-C-text");
    expect(textOf(out, "B")).toBe("q1-A-text"); // old correct text moved to label B
    expect(out.correctOptionId).toBe("B");
    // the correct option's TEXT is preserved through the move
    expect(textOf(out, out.correctOptionId)).toBe(textOf(q, q.correctOptionId));
  });

  it("preserves the full set of option texts (a pure permutation, no loss)", () => {
    const q = mkQ("q1", "C");
    const out = applyLayout(q, ["D", "C", "B", "A"]);
    expect(out.options.map((o) => o.text).sort()).toEqual(q.options.map((o) => o.text).sort());
  });

  it("leaves non-option fields (stem, explanation, ids) untouched", () => {
    const q = mkQ("q1", "B");
    const out = applyLayout(q, ["B", "A", "C", "D"]);
    expect(out.id).toBe(q.id);
    expect(out.stem).toBe(q.stem);
    expect(out.explanation).toBe(q.explanation);
    expect(out.domainKey).toBe(q.domainKey);
  });
});

describe("oldToNewMap", () => {
  it("maps each original label to its new label for a given order", () => {
    // newOrder ["C","A","D","B"]: old C->A, old A->B, old D->C, old B->D
    expect(oldToNewMap(["C", "A", "D", "B"])).toEqual({ C: "A", A: "B", D: "C", B: "D" });
  });
});

describe("layoutForTarget", () => {
  it("places the correct answer at the requested target label", () => {
    const q = mkQ("q1", "A");
    for (const target of ["A", "B", "C", "D"] as OptId[]) {
      const out = applyLayout(q, layoutForTarget(q, target, mulberry32(1)));
      expect(out.correctOptionId).toBe(target);
      expect(textOf(out, target)).toBe(textOf(q, "A"));
    }
  });

  it("preserves all option texts", () => {
    const q = mkQ("q1", "D");
    const out = applyLayout(q, layoutForTarget(q, "B", mulberry32(42)));
    expect(out.options.map((o) => o.text).sort()).toEqual(q.options.map((o) => o.text).sort());
  });
});

describe("planBalancedPermutations", () => {
  const qs = Array.from({ length: 131 }, (_, i) =>
    mkQ(`q${i}`, (["A", "B", "C", "D"] as OptId[])[i % 4]),
  );

  it("returns one layout per question", () => {
    const plan = planBalancedPermutations(qs, mulberry32(2025));
    expect(plan).toHaveLength(131);
  });

  it("produces a near-uniform distribution of the new correct position", () => {
    const plan = planBalancedPermutations(qs, mulberry32(2025));
    const dist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
    qs.forEach((q, i) => {
      dist[applyLayout(q, plan[i]).correctOptionId]++;
    });
    // 131 / 4 -> three of 33 and one of 32
    for (const k of ["A", "B", "C", "D"]) {
      expect(dist[k]).toBeGreaterThanOrEqual(32);
      expect(dist[k]).toBeLessThanOrEqual(33);
    }
  });

  it("is deterministic for a given seed", () => {
    expect(planBalancedPermutations(qs, mulberry32(7))).toEqual(planBalancedPermutations(qs, mulberry32(7)));
  });

  it("preserves every question's correct-answer text after applying its layout", () => {
    const plan = planBalancedPermutations(qs, mulberry32(2025));
    qs.forEach((q, i) => {
      const out = applyLayout(q, plan[i]);
      expect(textOf(out, out.correctOptionId)).toBe(textOf(q, q.correctOptionId));
    });
  });
});

describe("correctDistribution", () => {
  it("tallies correctOptionId across a bank", () => {
    const bank = [mkQ("a", "A"), mkQ("b", "A"), mkQ("c", "B"), mkQ("d", "C")];
    expect(correctDistribution(bank)).toEqual({ A: 2, B: 1, C: 1, D: 0 });
  });
});

// Build a realistically rebalanced bank: apply the plan and (for changed
// layouts) swap in a stand-in rewritten explanation.
function rebalance(qs: Question[], seed: number): Question[] {
  const plan = planBalancedPermutations(qs, mulberry32(seed));
  return qs.map((q, i) => {
    const out = applyLayout(q, plan[i]);
    const changed = out.options.map((o) => o.text).join("|") !== q.options.map((o) => o.text).join("|");
    return changed ? { ...out, explanation: q.explanation + " [remapped]" } : out;
  });
}

describe("validateRebalanced", () => {
  const original = Array.from({ length: 40 }, (_, i) =>
    mkQ(`q${i}`, (["A", "B", "C", "D"] as OptId[])[i % 4]),
  );

  it("accepts a correctly rebalanced bank", () => {
    const res = validateRebalanced(original, rebalance(original, 11));
    expect(res.errors).toEqual([]);
    expect(res.ok).toBe(true);
  });

  it("rejects a bank where an option's text was altered", () => {
    const bad = rebalance(original, 11);
    bad[3] = { ...bad[3], options: bad[3].options.map((o, i) => (i === 0 ? { ...o, text: "TAMPERED" } : o)) };
    const res = validateRebalanced(original, bad);
    expect(res.ok).toBe(false);
    expect(res.errors.join(" ")).toMatch(/q3/);
  });

  it("rejects a bank where the correct answer's content changed", () => {
    const bad = rebalance(original, 11);
    // flip correctOptionId to a different option -> correct text no longer matches original
    const q = bad[5];
    const other = (["A", "B", "C", "D"] as OptId[]).find((L) => L !== q.correctOptionId)!;
    bad[5] = { ...q, correctOptionId: other };
    const res = validateRebalanced(original, bad);
    expect(res.ok).toBe(false);
  });

  it("rejects a bank with a missing or reordered question", () => {
    const bad = rebalance(original, 11).slice(0, 39);
    expect(validateRebalanced(original, bad).ok).toBe(false);
  });

  it("rejects when a relabeled question kept its stale (unchanged) explanation", () => {
    const bad = rebalance(original, 11);
    // find a changed-layout question and revert its explanation to the original
    const idx = bad.findIndex(
      (q, i) => q.options.map((o) => o.text).join("|") !== original[i].options.map((o) => o.text).join("|"),
    );
    bad[idx] = { ...bad[idx], explanation: original[idx].explanation };
    const res = validateRebalanced(original, bad);
    expect(res.ok).toBe(false);
  });

  it("rejects a skewed distribution", () => {
    // all correct at A -> not balanced
    const skewed = original.map((q) => applyLayout(q, layoutForTarget(q, "A", mulberry32(1))));
    const res = validateRebalanced(original, skewed);
    expect(res.ok).toBe(false);
    expect(res.errors.join(" ")).toMatch(/distribut/i);
  });
});

describe("verifyRemap (deterministic explanation-remap checker)", () => {
  const map = { A: "B", B: "A", C: "D", D: "C" } as Record<OptId, OptId>;

  it("accepts a correct letter remap (only option letters changed)", () => {
    const oldE = "Correct (A): the workflow fits. B adds autonomy. C negotiates. D loops a human.";
    const newE = "Correct (B): the workflow fits. A adds autonomy. D negotiates. C loops a human.";
    const r = verifyRemap(oldE, newE, map);
    expect(r.issues).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("rejects any change to non-letter wording (content drift)", () => {
    const oldE = "Correct (A): the workflow fits. B adds autonomy.";
    const newE = "Correct (B): the workflow EXCELS. A adds autonomy.";
    expect(verifyRemap(oldE, newE, map).ok).toBe(false);
  });

  it("rejects a wrong B/C/D mapping", () => {
    const oldE = "Correct (A): ok. B adds autonomy. C negotiates. D loops.";
    const newE = "Correct (B): ok. C adds autonomy. D negotiates. C loops."; // B should map to A, not C
    expect(verifyRemap(oldE, newE, map).ok).toBe(false);
  });

  it("rejects an extra or missing option-letter token", () => {
    const oldE = "Correct (A): ok. B adds autonomy.";
    const newE = "Correct (B): ok. A adds autonomy. D extra."; // stray D
    expect(verifyRemap(oldE, newE, map).ok).toBe(false);
  });

  it("allows a capital A used as an English article to stay unchanged", () => {
    const m2 = { A: "C", B: "A", C: "B", D: "D" } as Record<OptId, OptId>;
    // First "A" is the article "A tight schema"; "B" is an option ref -> maps to A.
    const oldE = "A tight schema helps. B floods the window.";
    const newE = "A tight schema helps. A floods the window.";
    const r = verifyRemap(oldE, newE, m2);
    expect(r.ok).toBe(true);
    expect(r.aUnchanged).toBe(1);
  });

  it("rejects a capital A mapped to the wrong letter", () => {
    const m2 = { A: "C", B: "A", C: "B", D: "D" } as Record<OptId, OptId>;
    const oldE = "A is correct. B is wrong.";
    const newE = "D is correct. A is wrong."; // A->D is neither A nor mapped(C)
    expect(verifyRemap(oldE, newE, m2).ok).toBe(false);
  });
});
