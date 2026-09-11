import type { Question } from "../lib/types";

type OptId = "A" | "B" | "C" | "D";
const LABELS: OptId[] = ["A", "B", "C", "D"];
const DOMAIN_KEYS = ["agentic", "claudecode", "prompt", "tools", "context"];

// Pick `n` correct-answer positions that keep the bank's A/B/C/D distribution as
// even as possible: greedily assign each to the currently-lowest position.
export function assignBalancedTargets(counts: Record<string, number>, n: number): OptId[] {
  const c: Record<OptId, number> = { A: counts.A || 0, B: counts.B || 0, C: counts.C || 0, D: counts.D || 0 };
  const out: OptId[] = [];
  for (let i = 0; i < n; i++) {
    let best: OptId = "A";
    for (const L of LABELS) if (c[L] < c[best]) best = L;
    out.push(best);
    c[best]++;
  }
  return out;
}

// Next "<prefix>-q<N>" id, continuing from the highest existing N for that prefix.
export function nextIdFor(existing: string[], prefix: string): string {
  let max = 0;
  const re = new RegExp(`^${prefix}-q(\\d+)$`);
  for (const id of existing) {
    const m = id.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}-q${max + 1}`;
}

// Structural validation for a (possibly newly authored) question. Semantic
// correctness is checked adversarially elsewhere; this is the shape gate.
export function questionShapeErrors(q: Question): string[] {
  const e: string[] = [];
  if (!q.id || typeof q.id !== "string") e.push("missing id");
  if (q.unitKind !== "domain" && q.unitKind !== "scenario") e.push("unitKind must be domain|scenario");
  if (!DOMAIN_KEYS.includes(q.domainKey)) e.push(`invalid domainKey: ${q.domainKey}`);
  if (q.unitKind === "scenario" && !q.scenarioKey) e.push("scenario unitKind requires a scenarioKey");
  if (q.unitKind === "domain" && q.scenarioKey) e.push("domain unitKind must have a null scenarioKey");
  if (!["easy", "medium", "hard"].includes(q.difficulty)) e.push("invalid difficulty");
  if (!q.stem || !q.stem.trim()) e.push("empty stem");
  if (!Array.isArray(q.options) || q.options.map((o) => o.id).join("") !== "ABCD") {
    e.push("options must be labeled A,B,C,D in order");
  } else if (!q.options.every((o) => o.text && o.text.trim())) {
    e.push("blank option text");
  }
  if (!q.options?.some((o) => o.id === q.correctOptionId)) e.push(`correctOptionId ${q.correctOptionId} not among options`);
  if (!q.explanation || q.explanation.trim().length < 40) e.push("explanation too short (<40 chars)");
  return e;
}
