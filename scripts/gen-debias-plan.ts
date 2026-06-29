// Generate the deterministic answer-key debias plan: for each question, a
// balanced new option layout (tested in debias.ts) plus everything an agent
// needs to remap the explanation's letter references. Writes /tmp/debias-plan.json.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import type { Question } from "../lib/types";
import { mulberry32 } from "../lib/rng";
import { planBalancedPermutations, applyLayout, oldToNewMap, type OptId } from "./debias";

const SEED = 20260629;
const root = resolve(import.meta.dirname, "..");
const qs: Question[] = JSON.parse(readFileSync(resolve(root, "data/questions.json"), "utf8"));
const plan = planBalancedPermutations(qs, mulberry32(SEED));

const isIdentity = (m: Record<OptId, OptId>) => (["A", "B", "C", "D"] as OptId[]).every((k) => m[k] === k);

const payloads = qs.map((q, i) => {
  const after = applyLayout(q, plan[i]);
  const map = oldToNewMap(plan[i]);
  return {
    id: q.id,
    domainKey: q.domainKey,
    stem: q.stem,
    scenario: q.scenario,
    oldOptions: q.options,
    oldCorrect: q.correctOptionId,
    oldExplanation: q.explanation,
    newOptions: after.options,
    newCorrect: after.correctOptionId,
    oldToNew: map,
    identity: isIdentity(map),
  };
});

writeFileSync("/tmp/debias-plan.json", JSON.stringify(payloads, null, 2));

// Per-question payload files for the rewrite agents (non-identity only).
const QDIR = "/tmp/debias-q";
rmSync(QDIR, { recursive: true, force: true });
mkdirSync(QDIR, { recursive: true });
const manifest = payloads
  .filter((p) => !p.identity)
  .map((p) => {
    const file = `${QDIR}/${p.id}.json`;
    writeFileSync(
      file,
      JSON.stringify(
        {
          id: p.id,
          stem: p.stem,
          scenario: p.scenario,
          oldToNew: p.oldToNew,
          oldOptions: p.oldOptions,
          oldCorrect: p.oldCorrect,
          newOptions: p.newOptions,
          newCorrect: p.newCorrect,
          oldExplanation: p.oldExplanation,
        },
        null,
        2,
      ),
    );
    return { id: p.id, file };
  });
writeFileSync("/tmp/debias-manifest.json", JSON.stringify(manifest, null, 2));

const before: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
const after: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
qs.forEach((q, i) => {
  before[q.correctOptionId]++;
  after[applyLayout(q, plan[i]).correctOptionId]++;
});
console.log(`SEED=${SEED}  questions=${qs.length}`);
console.log("correct-answer position BEFORE:", before);
console.log("correct-answer position AFTER :", after);
console.log("identity (no relabel) questions:", payloads.filter((p) => p.identity).length);
console.log("questions needing explanation remap:", manifest.length);
console.log("wrote /tmp/debias-plan.json, /tmp/debias-manifest.json, /tmp/debias-q/<id>.json");
