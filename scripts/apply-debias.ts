// Assemble the rebalanced question bank from the deterministic layout plan
// (same SEED as gen-debias-plan.ts) + the verified explanation rewrites, then
// run the full validation gate. Writes data/questions.json ONLY with --write
// and ONLY if every check passes. Dry-run by default.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Question } from "../lib/types";
import { mulberry32 } from "../lib/rng";
import { planBalancedPermutations, applyLayout, validateRebalanced, correctDistribution } from "./debias";

const SEED = 20260629;
const root = resolve(import.meta.dirname, "..");
const qPath = resolve(root, "data/questions.json");
const original: Question[] = JSON.parse(readFileSync(qPath, "utf8"));
const plan = planBalancedPermutations(original, mulberry32(SEED));

type Rewrite = { id: string; newExplanation: string; ok: boolean };
const rewrites: Rewrite[] = JSON.parse(readFileSync("/tmp/debias-rewrites.json", "utf8"));
const rwById = new Map(rewrites.map((r) => [r.id, r]));

const problems: string[] = [];
const rebalanced: Question[] = original.map((q, i) => {
  const out = applyLayout(q, plan[i]);
  const changed = out.options.map((o) => o.text).join("") !== q.options.map((o) => o.text).join("");
  if (!changed) return out; // identity layout → keep the original explanation verbatim
  const rw = rwById.get(q.id);
  if (!rw) {
    problems.push(`${q.id}: layout changed but no explanation rewrite found`);
    return out;
  }
  if (!rw.ok) problems.push(`${q.id}: rewrite did not pass adversarial verification`);
  if (!rw.newExplanation || !rw.newExplanation.trim()) {
    problems.push(`${q.id}: empty rewritten explanation`);
    return out;
  }
  return { ...out, explanation: rw.newExplanation };
});

const res = validateRebalanced(original, rebalanced);
console.log("correct-position BEFORE:", correctDistribution(original));
console.log("correct-position AFTER :", correctDistribution(rebalanced));
console.log(`validation errors: ${res.errors.length}`);
res.errors.slice(0, 40).forEach((e) => console.log("  - " + e));
console.log(`rewrite problems: ${problems.length}`);
problems.slice(0, 40).forEach((e) => console.log("  - " + e));

const WRITE = process.argv.includes("--write");
const clean = res.ok && problems.length === 0;
if (clean && WRITE) {
  writeFileSync(qPath + ".bak", readFileSync(qPath));
  writeFileSync(qPath, JSON.stringify(rebalanced, null, 2) + "\n");
  console.log(`\nWROTE ${qPath} (backup at questions.json.bak)`);
} else if (!WRITE) {
  console.log(clean ? "\nAll checks pass: re-run with --write to apply." : "\nProblems found, NOT writable.");
} else {
  console.log("\nNOT WRITING: resolve the problems above first.");
}
process.exit(clean || !WRITE ? 0 : 1);
