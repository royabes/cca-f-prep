import type {
  Corpus,
  Question,
  DomainKey,
  Difficulty,
  UserLevel,
  AnswerRecord,
  SrsState,
} from "./types";
import { DOMAINS } from "./domains";
import { shuffle } from "./exam";
import type { Rng } from "./rng";

// Difficulty preference ordering by learner level. Earlier = preferred.
const LEVEL_DIFF_ORDER: Record<UserLevel, Difficulty[]> = {
  newcomer: ["easy", "medium", "hard"],
  practitioner: ["medium", "easy", "hard"],
  architect: ["hard", "medium", "easy"],
};

interface QStat {
  seen: number;
  lastCorrect: boolean | null;
  lastConfidence: number | null;
  lastTs: number;
}

function buildStats(answers: AnswerRecord[]): Map<string, QStat> {
  const m = new Map<string, QStat>();
  // answers are appended chronologically; later entries win for "last".
  for (const a of answers) {
    const prev = m.get(a.questionId) || {
      seen: 0,
      lastCorrect: null,
      lastConfidence: null,
      lastTs: 0,
    };
    m.set(a.questionId, {
      seen: prev.seen + 1,
      lastCorrect: a.correct,
      lastConfidence: a.confidence,
      lastTs: a.ts,
    });
  }
  return m;
}

// Priority score for picking a question, higher = more useful to study now.
function priority(q: Question, stat: QStat | undefined, level: UserLevel, dueIds: Set<string>): number {
  let p = 0;
  if (dueIds.has(q.id)) p += 100; // spaced-repetition due → top priority
  if (!stat) {
    p += 40; // unseen → good for coverage
  } else {
    if (stat.lastCorrect === false) p += 60; // got it wrong last time
    else if (stat.lastConfidence !== null && stat.lastConfidence < 2) p += 25; // shaky
    else p += 5; // seen & confident-correct → low priority
    // mild penalty for very recently seen, to interleave fresh material
    p -= Math.min(15, stat.seen * 3);
  }
  // Level/difficulty fit.
  const order = LEVEL_DIFF_ORDER[level];
  const idx = order.indexOf(q.difficulty);
  p += (order.length - idx) * 4; // preferred difficulty gets a small boost
  return p;
}

export interface AdaptiveOpts {
  count: number;
  level: UserLevel;
  domain?: DomainKey | "all";
  answers: AnswerRecord[];
  srs: Record<string, SrsState>;
  now: number;
  rng?: Rng;
}

// Diagnose→prescribe selection: weight toward weak/over-confident domains,
// surface due cards and previously-missed questions, fit difficulty to level,
// and interleave domains in the final order.
export function selectAdaptive(corpus: Corpus, opts: AdaptiveOpts): Question[] {
  const { count, level, answers, srs, now } = opts;
  const rng = opts.rng ?? Math.random;
  const stats = buildStats(answers);
  const dueIds = new Set(
    Object.values(srs)
      .filter((c) => c.kind === "question" && c.due <= now)
      .map((c) => c.refId),
  );

  // Per-domain weakness = blueprint weight x (1 - recent accuracy).
  const domainList =
    opts.domain && opts.domain !== "all"
      ? DOMAINS.filter((d) => d.key === opts.domain)
      : DOMAINS;

  function recentAccuracy(d: DomainKey): number {
    const rows = answers.filter((a) => a.domainKey === d).slice(-20);
    if (rows.length === 0) return 0.4; // unknown → assume weak-ish
    return rows.filter((a) => a.correct).length / rows.length;
  }

  // Allocate the session across domains by weakness weight. Largest-remainder
  // so the slots sum EXACTLY to `count`: a small session (count < #domains)
  // then goes to the weakest domains instead of always the first ones in
  // blueprint order (the old Math.max(1,...) over-allocated then truncated).
  const weights = domainList.map((d) => ({
    key: d.key,
    w: (d.weight / 100) * (1.2 - recentAccuracy(d.key)),
  }));
  const alloc = apportion(weights, count);

  const chosen: Question[] = [];
  const used = new Set<string>();

  for (const a of alloc) {
    const pool = corpus.questions
      .filter((q) => q.domainKey === a.key && !used.has(q.id))
      .map((q) => ({ q, p: priority(q, stats.get(q.id), level, dueIds) }))
      .sort((x, y) => y.p - x.p);
    // Take from the top of the priority list, with light randomization among ties.
    const top = pool.slice(0, a.n * 2);
    for (const { q } of shuffle(top, rng).slice(0, a.n)) {
      if (used.has(q.id)) continue;
      used.add(q.id);
      chosen.push(q);
    }
  }

  // Top up if rounding left us short.
  if (chosen.length < count) {
    const rest = corpus.questions
      .filter((q) => !used.has(q.id))
      .map((q) => ({ q, p: priority(q, stats.get(q.id), level, dueIds) }))
      .sort((x, y) => y.p - x.p);
    for (const { q } of rest) {
      if (chosen.length >= count) break;
      used.add(q.id);
      chosen.push(q);
    }
  }

  // Interleave domains: round-robin by domain rather than grouped blocks.
  return interleaveByDomain(chosen, rng).slice(0, count);
}

// Largest-remainder apportionment of `count` slots across domains by weight.
// Sums to exactly `count`; gives leftover slots to the highest-weight domains.
function apportion(weights: { key: DomainKey; w: number }[], count: number): { key: DomainKey; n: number }[] {
  const adj = weights.map((x) => ({ key: x.key, w: Math.max(0.0001, x.w) }));
  const wsum = adj.reduce((s, x) => s + x.w, 0);
  const base = adj.map((x) => {
    const raw = (x.w / wsum) * count;
    return { key: x.key, n: Math.floor(raw), frac: raw - Math.floor(raw) };
  });
  let assigned = base.reduce((s, b) => s + b.n, 0);
  const byFrac = [...base].sort((a, b) => b.frac - a.frac);
  let i = 0;
  while (assigned < count && byFrac.length > 0) {
    byFrac[i % byFrac.length].n++;
    assigned++;
    i++;
  }
  return base.map((b) => ({ key: b.key, n: b.n }));
}

export function interleaveByDomain(qs: Question[], rng: Rng = Math.random): Question[] {
  const byDomain = new Map<DomainKey, Question[]>();
  for (const q of qs) {
    const arr = byDomain.get(q.domainKey) || [];
    arr.push(q);
    byDomain.set(q.domainKey, arr);
  }
  // Shuffle each domain's queue in place. (shuffle() returns a new array, so the
  // result must be written back, discarding it was a silent no-op.)
  for (const [key, arr] of byDomain) byDomain.set(key, shuffle(arr, rng));
  const queues = [...byDomain.values()];
  const out: Question[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const queue of queues) {
      const next = queue.shift();
      if (next) {
        out.push(next);
        added = true;
      }
    }
  }
  return out;
}
