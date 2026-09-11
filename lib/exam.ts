import type { Corpus, Question, DomainKey, ExamResult } from "./types";
import { DOMAINS, EXAM } from "./domains";
import type { Rng } from "./rng";

export function shuffle<T>(arr: T[], rng: Rng = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Largest-remainder apportionment of `count` across domains by exam weight.
export function domainQuota(count: number): Record<DomainKey, number> {
  const total = DOMAINS.reduce((s, d) => s + d.weight, 0);
  const exact = DOMAINS.map((d) => ({ key: d.key, raw: (d.weight / total) * count }));
  const floors = exact.map((e) => ({ key: e.key, n: Math.floor(e.raw), frac: e.raw - Math.floor(e.raw) }));
  let assigned = floors.reduce((s, f) => s + f.n, 0);
  const order = [...floors].sort((a, b) => b.frac - a.frac);
  let i = 0;
  while (assigned < count) {
    order[i % order.length].n++;
    assigned++;
    i++;
  }
  const out = {} as Record<DomainKey, number>;
  for (const f of floors) out[f.key] = f.n;
  return out;
}

// Build a blueprint-weighted mock exam, preferring scenario-anchored questions
// (the real exam is scenario-driven) but filling from the full bank as needed.
export function buildExam(corpus: Corpus, count = EXAM.questionCount, rng: Rng = Math.random): Question[] {
  const quota = domainQuota(count);
  const picked: Question[] = [];
  const used = new Set<string>();

  for (const d of DOMAINS) {
    const need = quota[d.key];
    const pool = corpus.questions.filter((q) => q.domainKey === d.key);
    const scenarioFirst = [
      ...shuffle(pool.filter((q) => q.unitKind === "scenario"), rng),
      ...shuffle(pool.filter((q) => q.unitKind === "domain"), rng),
    ];
    for (const q of scenarioFirst) {
      if (picked.filter((p) => p.domainKey === d.key).length >= need) break;
      if (used.has(q.id)) continue;
      used.add(q.id);
      picked.push(q);
    }
  }

  // If a domain was short on questions, top up from anywhere to reach count.
  if (picked.length < count) {
    for (const q of shuffle(corpus.questions, rng)) {
      if (picked.length >= count) break;
      if (used.has(q.id)) continue;
      used.add(q.id);
      picked.push(q);
    }
  }

  return shuffle(picked, rng).slice(0, count);
}

export function scaledFromRaw(rawFraction: number): number {
  const s = EXAM.scaleMin + rawFraction * (EXAM.scaleMax - EXAM.scaleMin);
  return Math.round(Math.max(EXAM.scaleMin, Math.min(EXAM.scaleMax, s)));
}

export interface ScoredExam {
  scaledScore: number;
  passed: boolean;
  rawCorrect: number;
  total: number;
  perDomain: Record<DomainKey, { correct: number; total: number }>;
}

// Exam score is raw correctness mapped to the 100-1000 scale (mirrors the real
// closed-book exam: confidence is captured for calibration but not scored here).
export function scoreExam(
  questions: Question[],
  chosen: Record<string, "A" | "B" | "C" | "D" | null>,
): ScoredExam {
  const perDomain = {} as Record<DomainKey, { correct: number; total: number }>;
  for (const d of DOMAINS) perDomain[d.key] = { correct: 0, total: 0 };

  let correct = 0;
  for (const q of questions) {
    perDomain[q.domainKey].total++;
    if (chosen[q.id] && chosen[q.id] === q.correctOptionId) {
      correct++;
      perDomain[q.domainKey].correct++;
    }
  }
  const scaled = scaledFromRaw(questions.length ? correct / questions.length : 0);
  return {
    scaledScore: scaled,
    passed: scaled >= EXAM.passScaled,
    rawCorrect: correct,
    total: questions.length,
    perDomain,
  };
}

export function makeExamResult(
  scored: ScoredExam,
  durationMs: number,
  now: number,
): ExamResult {
  return {
    id: `exam-${now}`,
    ts: now,
    scaledScore: scored.scaledScore,
    passed: scored.passed,
    rawCorrect: scored.rawCorrect,
    total: scored.total,
    durationMs,
    perDomain: scored.perDomain,
  };
}
