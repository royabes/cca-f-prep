// Controlled-concurrency explanation remap. For each non-identity question, ask
// Claude to relabel ONLY the option-letter references per the layout plan, then
// gate every result through the deterministic verifyRemap() with a retry loop.
// Reuses any already-good rewrites salvaged from the earlier run. Writes
// /tmp/debias-rewrites.json. Run: npx tsx scripts/rewrite-explanations.ts
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { verifyRemap, type OptId } from "./debias";

const MODEL = "claude-opus-4-8";
const CONCURRENCY = 3;
const MAX_REWRITE_ATTEMPTS = 4;

function apiKey(): string {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  const f = resolve(homedir(), ".anthropic_api_key");
  if (existsSync(f)) return readFileSync(f, "utf8").trim();
  throw new Error("no ANTHROPIC_API_KEY and no ~/.anthropic_api_key");
}
const client = new Anthropic({ apiKey: apiKey() });

type Payload = {
  id: string;
  stem: string;
  scenario: string | null;
  oldToNew: Record<OptId, OptId>;
  oldOptions: { id: OptId; text: string }[];
  oldCorrect: OptId;
  newOptions: { id: OptId; text: string }[];
  newCorrect: OptId;
  oldExplanation: string;
};

const manifest: { id: string; file: string }[] = JSON.parse(readFileSync("/tmp/debias-manifest.json", "utf8"));
const partials: { id: string; newExplanation: string }[] = existsSync("/tmp/debias-rewrites-partial.json")
  ? JSON.parse(readFileSync("/tmp/debias-rewrites-partial.json", "utf8"))
  : [];
const partialById = new Map(partials.map((p) => [p.id, p.newExplanation]));

const SYSTEM =
  "You relabel the option-letter references in a multiple-choice question's explanation after its answer options have been reordered. You change ONLY the capital letters A-D that denote answer options; every other character stays byte-identical. Output ONLY the rewritten explanation wrapped in <new>...</new> — no preamble, no reasoning, no commentary.";

function buildPrompt(p: Payload, prev: string | null, issues: string[] | null): string {
  const mapLines = (["A", "B", "C", "D"] as OptId[]).map((L) => `  old ${L} -> new ${p.oldToNew[L]}`).join("\n");
  const oldOpts = p.oldOptions.map((o) => `  ${o.id}. ${o.text}`).join("\n");
  const newOpts = p.newOptions.map((o) => `  ${o.id}. ${o.text}`).join("\n");
  let retry = "";
  if (prev && issues) {
    retry = `\n\nYour previous attempt FAILED a strict check with these problems:\n${issues.map((s) => "- " + s).join("\n")}\nPrevious attempt was:\n<new>${prev}</new>\nFix exactly these and try again.`;
  }
  return `An MCQ's options were reordered. The TEXT of each option is unchanged; only its letter label changed, per this exact mapping:
${mapLines}

OLD options (letters the explanation currently uses):
${oldOpts}

NEW options (letters the explanation must use after rewrite):
${newOpts}

The new correct answer is ${p.newCorrect}.

OLD explanation (references options by their OLD letters):
"""
${p.oldExplanation}
"""

Rewrite the explanation so every reference to an answer option uses its NEW letter (per the mapping).
Rules:
- B, C, D are ALWAYS option references — always remap them per the mapping.
- A capital "A" may be an option reference (remap it) OR the ordinary English article "A" (leave it as "A"). Decide from context.
- Change NOTHING else: same words, numbers, punctuation, sentence order. This is a relabel, not a reword.
- If it begins "Correct (X):", set X to ${p.newCorrect}.${retry}`;
}

function extractNew(text: string): string {
  const m = text.match(/<new>([\s\S]*?)<\/new>/i);
  return (m ? m[1] : text).trim();
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let delay = 2000;
  for (let a = 0; ; a++) {
    try {
      return await fn();
    } catch (e: unknown) {
      const err = e as { status?: number; message?: string };
      const msg = String(err?.message ?? e);
      const status = err?.status;
      const retryable = status === 429 || status === 529 || (status ?? 0) >= 500 || /rate|overload|limit|timeout|ECONN/i.test(msg);
      if (a >= 6 || !retryable) throw e;
      await sleep(delay);
      delay = Math.min(delay * 2, 30000);
    }
  }
}

type Result = { id: string; newExplanation: string; ok: boolean; aUnchanged?: number; issues?: string[]; source: string };

async function rewriteOne(p: Payload): Promise<Result> {
  let prev: string | null = null;
  let lastIssues: string[] = [];
  for (let attempt = 0; attempt < MAX_REWRITE_ATTEMPTS; attempt++) {
    const msg = await withRetry(() =>
      client.messages.create({ model: MODEL, max_tokens: 2000, system: SYSTEM, messages: [{ role: "user", content: buildPrompt(p, prev, prev ? lastIssues : null) }] }),
    );
    const text = msg.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
    const ne = extractNew(text);
    const v = verifyRemap(p.oldExplanation, ne, p.oldToNew);
    if (v.ok) return { id: p.id, newExplanation: ne, ok: true, aUnchanged: v.aUnchanged, source: `llm:${attempt + 1}` };
    prev = ne;
    lastIssues = v.issues;
  }
  return { id: p.id, newExplanation: prev ?? "", ok: false, issues: lastIssues, source: "llm:failed" };
}

async function pool<I, O>(items: I[], n: number, worker: (item: I, i: number) => Promise<O>): Promise<O[]> {
  const out: O[] = new Array(items.length);
  let i = 0;
  let done = 0;
  const run = async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await worker(items[idx], idx);
      done++;
      if (done % 10 === 0 || done === items.length) console.log(`  ${done}/${items.length}`);
    }
  };
  await Promise.all(Array.from({ length: n }, run));
  return out;
}

async function main() {
  const payloads: Payload[] = manifest.map((m) => JSON.parse(readFileSync(m.file, "utf8")));

  // Reuse salvaged rewrites that pass verification; only call the API for the rest.
  const reused: Result[] = [];
  const todo: Payload[] = [];
  for (const p of payloads) {
    const cand = partialById.get(p.id);
    if (cand) {
      const v = verifyRemap(p.oldExplanation, cand, p.oldToNew);
      if (v.ok) {
        reused.push({ id: p.id, newExplanation: cand, ok: true, aUnchanged: v.aUnchanged, source: "reused" });
        continue;
      }
    }
    todo.push(p);
  }
  console.log(`reused ${reused.length} verified rewrites; calling ${MODEL} for ${todo.length} (concurrency ${CONCURRENCY})`);

  const fresh = await pool(todo, CONCURRENCY, (p) => rewriteOne(p));
  const all = [...reused, ...fresh];
  all.sort((a, b) => manifest.findIndex((m) => m.id === a.id) - manifest.findIndex((m) => m.id === b.id));

  writeFileSync("/tmp/debias-rewrites.json", JSON.stringify(all.map(({ id, newExplanation, ok, aUnchanged }) => ({ id, newExplanation, ok, aUnchanged })), null, 2));

  const failed = all.filter((r) => !r.ok);
  const aFlags = all.filter((r) => (r.aUnchanged ?? 0) > 0);
  console.log(`\ntotal ${all.length} | ok ${all.length - failed.length} | failed ${failed.length}`);
  if (failed.length) console.log("failed ids:", failed.map((f) => f.id).join(", "));
  console.log(`questions where a capital A was left unchanged (review): ${aFlags.length}`);
  console.log("wrote /tmp/debias-rewrites.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
