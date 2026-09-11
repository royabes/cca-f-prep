// Merge the accepted new questions into data/questions.json: assign sequential
// scenario-prefixed ids, strip scratch fields, validate every item's shape +
// id uniqueness, and report the final answer-position distribution. Dry-run by
// default; pass --write to apply. Run: npx tsx scripts/integrate-questions.ts
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Question } from "../lib/types";
import { nextIdFor, questionShapeErrors } from "./integrate";

const root = resolve(import.meta.dirname, "..");
const qPath = resolve(root, "data/questions.json");
const bank: Question[] = JSON.parse(readFileSync(qPath, "utf8"));
type Raw = Question & { _spec?: unknown; _attempts?: number };
const incoming: Raw[] = JSON.parse(readFileSync("/tmp/ccaf-new-questions.json", "utf8"));

const ids = bank.map((q) => q.id);
const errors: string[] = [];
const newQs: Question[] = [];

for (const raw of incoming) {
  const prefix = raw.scenarioKey || raw.domainKey;
  const id = nextIdFor(ids, prefix);
  ids.push(id);
  const q: Question = {
    id,
    unitKind: raw.unitKind,
    unitKey: raw.unitKey,
    domainKey: raw.domainKey,
    scenarioKey: raw.scenarioKey,
    topic: raw.topic,
    difficulty: raw.difficulty,
    scenario: raw.scenario,
    stem: raw.stem,
    options: raw.options.map((o) => ({ id: o.id, text: o.text })),
    correctOptionId: raw.correctOptionId,
    explanation: raw.explanation,
  };
  const e = questionShapeErrors(q);
  if (e.length) errors.push(`${id}: ${e.join("; ")}`);
  newQs.push(q);
}

const merged = [...bank, ...newQs];
const idSet = new Set(merged.map((q) => q.id));
if (idSet.size !== merged.length) errors.push("duplicate ids after merge");

const dist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
for (const q of merged) dist[q.correctOptionId]++;
const perDomain: Record<string, number> = {};
for (const q of merged) perDomain[q.domainKey] = (perDomain[q.domainKey] || 0) + 1;
const perScenario: Record<string, number> = {};
for (const q of merged) if (q.scenarioKey) perScenario[q.scenarioKey] = (perScenario[q.scenarioKey] || 0) + 1;

console.log(`bank ${bank.length} + new ${newQs.length} = ${merged.length}`);
console.log("answer-position distribution:", JSON.stringify(dist), `(max share ${(Math.max(...Object.values(dist)) / merged.length * 100).toFixed(1)}%)`);
console.log("per-domain:", JSON.stringify(perDomain));
const total = merged.length;
console.log("per-domain %:", Object.fromEntries(Object.entries(perDomain).map(([k, v]) => [k, (v / total * 100).toFixed(1)])));
console.log("per-scenario:", JSON.stringify(perScenario));
console.log(`validation errors: ${errors.length}`);
errors.slice(0, 40).forEach((e) => console.log("  - " + e));

const WRITE = process.argv.includes("--write");
if (!errors.length && WRITE) {
  writeFileSync(qPath, JSON.stringify(merged, null, 2) + "\n");
  console.log(`\nWROTE ${qPath} (${merged.length} questions)`);
} else if (!WRITE) {
  console.log(errors.length ? "\nProblems found, not writable." : "\nAll checks pass: re-run with --write to apply.");
} else {
  console.log("\nNOT WRITING, fix problems first.");
}
process.exit(errors.length && WRITE ? 1 : 0);
