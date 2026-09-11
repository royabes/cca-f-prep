import type { Question } from "../lib/types";
import { shuffle } from "../lib/exam";
import type { Rng } from "../lib/rng";

export type OptId = "A" | "B" | "C" | "D";
const LABELS: OptId[] = ["A", "B", "C", "D"];

// A layout is the list of original option ids arranged in their NEW positional
// order: position i (label LABELS[i]) receives the original option `newOrder[i]`.

// Map each original option label to the new label it occupies under `newOrder`.
export function oldToNewMap(newOrder: OptId[]): Record<OptId, OptId> {
  const m = {} as Record<OptId, OptId>;
  newOrder.forEach((origId, i) => {
    m[origId] = LABELS[i];
  });
  return m;
}

// Apply a layout: relabel options A..D by their new position (text preserved)
// and remap correctOptionId to wherever the correct option moved. Pure.
export function applyLayout(q: Question, newOrder: OptId[]): Question {
  const byId = new Map(q.options.map((o) => [o.id, o] as const));
  const options = newOrder.map((origId, i) => ({ id: LABELS[i], text: byId.get(origId)!.text }));
  const map = oldToNewMap(newOrder);
  return { ...q, options, correctOptionId: map[q.correctOptionId] };
}

// Build a layout that places the correct option at `target`, with the three
// distractors shuffled into the remaining slots.
export function layoutForTarget(q: Question, target: OptId, rng: Rng): OptId[] {
  const targetIdx = LABELS.indexOf(target);
  const distractors = shuffle(
    q.options.map((o) => o.id).filter((id) => id !== q.correctOptionId),
    rng,
  );
  const order: (OptId | null)[] = [null, null, null, null];
  order[targetIdx] = q.correctOptionId;
  let d = 0;
  for (let i = 0; i < 4; i++) if (order[i] === null) order[i] = distractors[d++];
  return order as OptId[];
}

// Assign every question a layout so the resulting correct-answer positions are
// distributed near-uniformly across A/B/C/D (counts differ by at most 1).
// Deterministic given the rng.
export function planBalancedPermutations(qs: Question[], rng: Rng): OptId[][] {
  const targets: OptId[] = qs.map((_, i) => LABELS[i % 4]);
  const shuffledTargets = shuffle(targets, rng);
  return qs.map((q, i) => layoutForTarget(q, shuffledTargets[i], rng));
}

// Deterministic check that a rewritten explanation is EXACTLY the original with
// only its option-letter references relabeled per `oldToNew`. Guarantees:
//  - no content drift: everything except standalone A-D letters is byte-identical;
//  - B/C/D (never English words) map exactly per oldToNew;
//  - A may either map (option reference) or stay A (the English article "A").
// The only thing it can't adjudicate is whether a *retained* capital A was truly
// an article vs. an unmapped option ref, surfaced via `aUnchanged` for review.
export function verifyRemap(
  oldExpl: string,
  newExpl: string,
  oldToNew: Record<OptId, OptId>,
): { ok: boolean; issues: string[]; aUnchanged: number } {
  const issues: string[] = [];
  const SENT = "\u0001";
  const tokenize = (s: string) => {
    const letters: OptId[] = [];
    const residual = s.replace(/(^|[^A-Za-z])([A-D])(?=[^A-Za-z]|$)/g, (_m, pre: string, ch: OptId) => {
      letters.push(ch);
      return pre + SENT;
    });
    return { residual, letters };
  };
  const o = tokenize(oldExpl);
  const n = tokenize(newExpl);
  if (o.residual !== n.residual) {
    issues.push("content changed outside option letters (drift, or a different number/placement of option letters)");
    return { ok: false, issues, aUnchanged: 0 };
  }
  let aUnchanged = 0;
  for (let i = 0; i < o.letters.length; i++) {
    const lo = o.letters[i];
    const ln = n.letters[i];
    if (lo === "A") {
      if (ln === oldToNew.A) continue; // mapped option ref (also covers A→A identity)
      if (ln === "A") {
        aUnchanged++; // retained, treated as the English article
        continue;
      }
      issues.push(`A at slot ${i} became ${ln} (expected A or ${oldToNew.A})`);
    } else if (ln !== oldToNew[lo]) {
      issues.push(`${lo} at slot ${i} became ${ln} (expected ${oldToNew[lo]})`);
    }
  }
  return { ok: issues.length === 0, issues, aUnchanged };
}

export function correctDistribution(qs: Question[]): Record<OptId, number> {
  const d: Record<OptId, number> = { A: 0, B: 0, C: 0, D: 0 };
  for (const q of qs) d[q.correctOptionId]++;
  return d;
}

const textsByPosition = (q: Question) => q.options.map((o) => o.text).join("");
const textOfOption = (q: Question, id: OptId) => q.options.find((o) => o.id === id)?.text;

// Full safety net before overwriting the bank: every correct answer's CONTENT
// must be preserved, options must stay a pure permutation, relabeled questions
// must have a freshly remapped explanation, and the new correct-position
// distribution must be balanced.
export function validateRebalanced(
  original: Question[],
  rebalanced: Question[],
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (original.length !== rebalanced.length) {
    errors.push(`length mismatch: original ${original.length} vs rebalanced ${rebalanced.length}`);
    return { ok: false, errors };
  }
  for (let i = 0; i < original.length; i++) {
    const o = original[i];
    const r = rebalanced[i];
    const tag = `[${o.id}]`;
    if (o.id !== r.id) {
      errors.push(`${tag} id/order mismatch at index ${i}: got ${r.id}`);
      continue;
    }
    if (r.options.map((x) => x.id).join("") !== "ABCD") {
      errors.push(`${tag} options are not labeled A,B,C,D in order`);
    }
    const oTexts = o.options.map((x) => x.text).sort();
    const rTexts = r.options.map((x) => x.text).sort();
    if (JSON.stringify(oTexts) !== JSON.stringify(rTexts)) {
      errors.push(`${tag} option texts changed (content tampered)`);
    }
    if (textOfOption(r, r.correctOptionId) !== textOfOption(o, o.correctOptionId)) {
      errors.push(`${tag} correct-answer content changed`);
    }
    if (!r.explanation || !r.explanation.trim()) {
      errors.push(`${tag} empty explanation`);
    }
    const layoutChanged = textsByPosition(o) !== textsByPosition(r);
    if (layoutChanged && r.explanation === o.explanation) {
      errors.push(`${tag} layout changed but explanation was not remapped (stale option letters)`);
    }
    if (!layoutChanged && r.explanation !== o.explanation) {
      errors.push(`${tag} layout unchanged but explanation was modified`);
    }
  }
  const dist = correctDistribution(rebalanced);
  const n = rebalanced.length;
  const lo = Math.floor(n / 4);
  const hi = Math.ceil(n / 4);
  for (const k of LABELS) {
    if (dist[k] < lo || dist[k] > hi) {
      errors.push(`distribution not balanced: ${k}=${dist[k]} (expected ${lo}..${hi})`);
    }
  }
  return { ok: errors.length === 0, errors };
}
