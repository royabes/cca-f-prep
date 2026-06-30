import type { AnswerRecord, ExamResult, Corpus, DomainKey } from "./types";
import { DOMAINS, DOMAIN_MAP, EXAM } from "./domains";

export interface DomainReadiness {
  key: DomainKey;
  attempts: number;
  distinctAttempted: number;
  totalQuestions: number;
  coverage: number; // 0..1
  rawAccuracy: number; // 0..1 (recency-weighted)
  mastery: number; // 0..100 (shrunken + calibration-penalized)
  masteredFrac: number; // confident & correct
  misinformedFrac: number; // confident & WRONG — the "danger zone"
  weight: number; // exam blueprint weight
}

export type Tier =
  | "Not ready"
  | "Building"
  | "Borderline"
  | "Likely pass"
  | "Highly likely";

export interface Prescription {
  kind: "danger" | "weak-domain" | "review-due" | "take-exam" | "coverage";
  domainKey?: DomainKey;
  title: string;
  detail: string;
  href: string;
}

export interface Readiness {
  perDomain: DomainReadiness[];
  weightedMastery: number; // 0..100
  predictedScaled: number; // 100..1000 from mastery only
  readinessScaled: number; // 100..1000 blended with real mock-exam history
  tier: Tier;
  passProbability: number; // 0..1, calibrated heuristic
  examReady: boolean; // strict consistency gate
  prescriptions: Prescription[];
  calibration: { confidence: 0 | 1 | 2; label: string; n: number; accuracy: number }[];
  totalAnswered: number;
}

const PRIOR_MEAN = 0.45; // neutral prior before evidence
const PRIOR_STRENGTH = 6; // pseudo-attempts

function recencyWeights(n: number): number[] {
  // Most-recent answer weight 1.0, decaying by 0.97 per step back.
  const w: number[] = [];
  for (let i = 0; i < n; i++) w.push(Math.pow(0.97, i));
  return w;
}

function scaledFromMastery(masteryFrac: number): number {
  const s = EXAM.scaleMin + masteryFrac * (EXAM.scaleMax - EXAM.scaleMin);
  return Math.round(Math.max(EXAM.scaleMin, Math.min(EXAM.scaleMax, s)));
}

function tierOf(scaled: number): Tier {
  if (scaled < 600) return "Not ready";
  if (scaled < 690) return "Building";
  if (scaled < 740) return "Borderline";
  if (scaled < 820) return "Likely pass";
  return "Highly likely";
}

export function computeReadiness(
  answers: AnswerRecord[],
  exams: ExamResult[],
  corpus: Corpus,
  now: number,
): Readiness {
  const totalByDomain: Record<string, number> = {};
  for (const d of DOMAINS) totalByDomain[d.key] = 0;
  for (const q of corpus.questions) totalByDomain[q.domainKey]++;

  const perDomain: DomainReadiness[] = DOMAINS.map((d) => {
    const rows = answers
      .filter((a) => a.domainKey === d.key)
      .sort((a, b) => b.ts - a.ts); // most recent first
    const weights = recencyWeights(rows.length);

    let wAttempts = 0;
    let wCorrect = 0;
    let confidentCorrect = 0;
    let confidentWrong = 0;
    let ratedN = 0; // answers where confidence was genuinely captured (not exam mode)
    const distinct = new Set<string>();

    rows.forEach((a, i) => {
      const w = weights[i];
      wAttempts += w;
      if (a.correct) wCorrect += w;
      distinct.add(a.questionId);
      // The mock exam records no real confidence (stored as a placeholder), so it
      // must not feed the confidence/danger-zone stats — only count rated modes.
      if (a.mode !== "exam") {
        ratedN++;
        if (a.confidence === 2 && a.correct) confidentCorrect++;
        if (a.confidence === 2 && !a.correct) confidentWrong++;
      }
    });

    const rawAccuracy = wAttempts > 0 ? wCorrect / wAttempts : 0;
    const shrunk =
      (wCorrect + PRIOR_MEAN * PRIOR_STRENGTH) /
      (wAttempts + PRIOR_STRENGTH);

    const n = rows.length;
    const masteredFrac = ratedN > 0 ? confidentCorrect / ratedN : 0;
    const misinformedFrac = ratedN > 0 ? confidentWrong / ratedN : 0;

    // Confident-but-wrong answers are the most dangerous; penalize mastery.
    const calibration = 1 - 0.45 * misinformedFrac;
    const mastery = Math.round(100 * shrunk * calibration);

    const total = totalByDomain[d.key] || 0;
    return {
      key: d.key,
      attempts: n,
      distinctAttempted: distinct.size,
      totalQuestions: total,
      coverage: total > 0 ? distinct.size / total : 0,
      rawAccuracy,
      mastery: Math.max(0, Math.min(100, mastery)),
      masteredFrac,
      misinformedFrac,
      weight: d.weight,
    };
  });

  const totalWeight = DOMAINS.reduce((s, d) => s + d.weight, 0);
  const weightedMastery =
    perDomain.reduce((s, d) => s + d.mastery * d.weight, 0) / totalWeight;

  const predictedScaled = scaledFromMastery(weightedMastery / 100);

  // Blend with the most recent mock exams — the strongest predictor.
  const recentExams = [...exams].sort((a, b) => b.ts - a.ts).slice(0, 3);
  let readinessScaled = predictedScaled;
  if (recentExams.length > 0) {
    const examAvg =
      recentExams.reduce((s, e) => s + e.scaledScore, 0) / recentExams.length;
    const wExam = Math.min(0.65, 0.3 + recentExams.length * 0.12);
    readinessScaled = Math.round(examAvg * wExam + predictedScaled * (1 - wExam));
  }

  const tier = tierOf(readinessScaled);

  // Heuristic pass probability via logistic curve centered on the 720 cut.
  const passProbability =
    1 / (1 + Math.exp(-(readinessScaled - EXAM.passScaled) / 55));

  // Strict consistency gate: at least two recent mock exams clearing 720 with margin.
  const strongExams = recentExams.filter((e) => e.scaledScore >= 760).length;
  const examReady =
    recentExams.length >= 2 &&
    strongExams >= 2 &&
    readinessScaled >= 740 &&
    perDomain.every((d) => d.mastery >= 65);

  const prescriptions = buildPrescriptions(perDomain, exams, corpus, now);

  // Overall confidence calibration buckets.
  const buckets: { confidence: 0 | 1 | 2; label: string; n: number; correct: number }[] = [
    { confidence: 0, label: "Guessing", n: 0, correct: 0 },
    { confidence: 1, label: "Unsure", n: 0, correct: 0 },
    { confidence: 2, label: "Confident", n: 0, correct: 0 },
  ];
  for (const a of answers) {
    if (a.mode === "exam") continue; // exam confidence is a placeholder, not a real self-rating
    const b = buckets[a.confidence];
    b.n++;
    if (a.correct) b.correct++;
  }

  return {
    perDomain,
    weightedMastery,
    predictedScaled,
    readinessScaled,
    tier,
    passProbability,
    examReady,
    prescriptions,
    calibration: buckets.map((b) => ({
      confidence: b.confidence,
      label: b.label,
      n: b.n,
      accuracy: b.n > 0 ? b.correct / b.n : 0,
    })),
    totalAnswered: answers.length,
  };
}

function buildPrescriptions(
  perDomain: DomainReadiness[],
  exams: ExamResult[],
  _corpus: Corpus,
  _now: number,
): Prescription[] {
  const out: Prescription[] = [];

  // 1) Danger zone first: domains with confident-but-wrong answers.
  const danger = [...perDomain]
    .filter((d) => d.misinformedFrac > 0.12 && d.attempts >= 4)
    .sort((a, b) => b.misinformedFrac - a.misinformedFrac);
  for (const d of danger.slice(0, 2)) {
    out.push({
      kind: "danger",
      domainKey: d.key,
      title: `Fix misconceptions in ${DOMAIN_MAP[d.key].short}`,
      detail: `You answered ${Math.round(
        d.misinformedFrac * 100,
      )}% of these confidently but wrong — the highest-risk gap. Re-read the lesson, then re-drill.`,
      href: `/study?d=${d.key}`,
    });
  }

  // 2) Weak domains ranked by expected score gain (weight x gap).
  const weak = [...perDomain]
    .map((d) => ({ d, gain: (d.weight / 100) * (100 - d.mastery) }))
    .sort((a, b) => b.gain - a.gain);
  for (const { d } of weak.slice(0, 2)) {
    if (d.mastery >= 80) continue;
    out.push({
      kind: "weak-domain",
      domainKey: d.key,
      title: `Drill ${DOMAIN_MAP[d.key].short} (${d.weight}% of the exam)`,
      detail: `Mastery ${d.mastery}/100. This domain carries ${d.weight}% weight, so closing the gap moves your score the most.`,
      href: `/practice?d=${d.key}`,
    });
  }

  // 3) Low coverage prompt.
  const lowCov = perDomain.find((d) => d.coverage < 0.5 && d.totalQuestions > 0);
  if (lowCov) {
    out.push({
      kind: "coverage",
      domainKey: lowCov.key,
      title: `See more ${DOMAIN_MAP[lowCov.key].short} questions`,
      detail: `You've only seen ${Math.round(
        lowCov.coverage * 100,
      )}% of this domain's question bank. Broaden exposure before trusting your score.`,
      href: `/practice?d=${lowCov.key}`,
    });
  }

  // 4) Mock exam cadence (research: re-test every 5–7 days; consistency matters).
  if (exams.length === 0) {
    out.push({
      kind: "take-exam",
      title: "Take a diagnostic mock exam",
      detail:
        "60 questions, 120 minutes, weighted like the real CCA-F. Your recent mock scores are the single best predictor of passing.",
      href: "/exam",
    });
  }

  return out.slice(0, 5);
}
