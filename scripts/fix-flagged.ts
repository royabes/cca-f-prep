// Fix the genuinely-stale items the audit surfaced (after verifying each against
// authoritative docs). Two modes: "explanation" (revise explanation only, keep
// options + correctOptionId), "rewrite" (re-author content but KEEP the correct
// answer at its current position so the balanced key is preserved). Each fix is
// re-audited against CORRECTED facts. Dry-run default; --write to apply.
// Run: npx tsx scripts/fix-flagged.ts [--write]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type { Question } from "../lib/types";
import { questionShapeErrors } from "./integrate";

const MODEL = "claude-opus-4-8";
const CONCURRENCY = 3;
function apiKey(): string {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  const f = resolve(homedir(), ".anthropic_api_key");
  if (existsSync(f)) return readFileSync(f, "utf8").trim();
  throw new Error("no key");
}
const client = new Anthropic({ apiKey: apiKey() });
const root = resolve(import.meta.dirname, "..");

// Facts with the CORRECTED Claude Code precedence (project>user, --bare real).
const FACTS = `CURRENT, DOCUMENTED ANTHROPIC FACTS:
- Bare model ids only (claude-opus-4-8/4-7/4-6, claude-sonnet-4-6, claude-haiku-4-5, claude-fable-5).
- Assistant PREFILL is REMOVED on the 4.6+ family (HTTP 400); legacy-only. Steer format via output_config.format or system instructions.
- Context windows: Opus/Sonnet/Fable default 1M; Haiku 4.5 = 200K. No universal 200K. Overflow => stop_reason model_context_window_exceeded.
- Structured output: output_config:{format:{type:"json_schema"}} (constrained decoding) is the CURRENT preferred mechanism; strict:true tool use also current; plain tool_use-for-JSON is the OLDER (still valid) pattern; output_format param is deprecated.
- Adaptive thinking (thinking:{type:"adaptive"}) + output_config.effort; budget_tokens deprecated on 4.6+.
- stop_reason: end_turn, tool_use, max_tokens, stop_sequence, pause_turn, refusal, model_context_window_exceeded.
- MCP transports stdio + Streamable HTTP/SSE (no WebSocket). tool_choice auto|any|tool|none.
- Claude Code memory: CLAUDE.md files are CONCATENATED into context (NOT overriding). Load order broadest->most-specific: managed-policy -> user(~/.claude) -> project(./ or ./.claude) -> local(CLAUDE.local.md). More-specific is read LAST and WINS on conflict, so PROJECT overrides USER and LOCAL overrides PROJECT; managed policy is non-excludable/highest authority. .claude/rules: user-level loads before project, giving project rules higher priority. CLAUDE.md is injected context, not enforced config (use a PreToolUse hook, exit 2, for hard enforcement).
- claude --bare = minimal mode skipping auto-discovery of hooks/skills/plugins/MCP/auto-memory/CLAUDE.md for fast, reproducible scripted/CI runs (a REAL flag).`;

const CURRENCY = `This explanation calls tool_use-with-input_json_schema "the recommended/canonical/most reliable" way to get structured output. That phrasing is dated. Revise ONLY the explanation to: (a) stop calling tool_use the canonical/recommended method; (b) briefly note output_config.format (json_schema constrained decoding) is the CURRENT preferred mechanism (with strict:true tool use also valid); (c) keep the marked answer correct, it remains a valid choice among the OFFERED options. Do not change any option text or the correct answer.`;

type Fix = { id: string; mode: "explanation" | "rewrite"; directive: string };
const FIXES: Fix[] = [
  { id: "prompt-q5", mode: "rewrite", directive: "This item currently treats assistant PREFILLING as a valid output-steering technique: STALE (prefill returns HTTP 400 on the 4.6+ family). Re-author it (original, scenario-based) so the correct answer reflects CURRENT practice: control/guarantee output format with output_config.format (json_schema constrained decoding) and/or strict tool use + system-prompt instructions. Make 'prefill the assistant turn' one of the WRONG options (tempting but removed). Keep the question testing format-control technique selection." },
  { id: "context-q3", mode: "explanation", directive: "Make the explanation model-accurate about context windows: do NOT assert a universal 200K window (Opus/Sonnet/Fable default 1M; Haiku 4.5 = 200K). Keep the correct answer (hybrid retrieval + rerank) and all option texts exactly; adjust only explanation phrasing." },
  { id: "extraction-q4", mode: "explanation", directive: "The explanation references the '200K context window' as if universal. Make it model-accurate (no universal 200K; Opus/Sonnet/Fable default 1M, Haiku 4.5 = 200K). The point that 400K receipts exceed any window and that the Batch API is the right tool still holds. Keep the correct answer (Batch API) and all options exactly; revise only explanation phrasing." },
  ...["prompt-q1", "prompt-q10", "prompt-q13", "support-q5", "codegen-q5", "research-q5", "devprod-q6", "cicd-q5", "extraction-q1"].map(
    (id): Fix => ({ id, mode: "explanation", directive: CURRENCY }),
  ),
];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let d = 2000;
  for (let a = 0; ; a++) {
    try {
      return await fn();
    } catch (e: unknown) {
      const err = e as { status?: number; message?: string };
      const retry = err?.status === 429 || err?.status === 529 || (err?.status ?? 0) >= 500 || /rate|overload|limit|timeout|ECONN/i.test(String(err?.message ?? e));
      if (a >= 6 || !retry) throw e;
      await sleep(d);
      d = Math.min(d * 2, 30000);
    }
  }
}
async function ask(system: string, user: string, maxTokens: number): Promise<string> {
  const m = await withRetry(() => client.messages.create({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }));
  return m.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
}
const grab = (t: string, tag: string) => {
  const m = t.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  return (m ? m[1] : t).trim();
};
async function pool<I, O>(items: I[], n: number, w: (i: I) => Promise<O>): Promise<O[]> {
  const out: O[] = new Array(items.length);
  let i = 0;
  const run = async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await w(items[idx]);
    }
  };
  await Promise.all(Array.from({ length: n }, run));
  return out;
}

async function reaudit(q: Question): Promise<{ ok: boolean; issues: string[] }> {
  const sys = "You are a meticulous CCA-F item auditor. Verify against the given CURRENT facts. Output ONLY <a>{\"ok\":bool,\"issues\":[...]}</a>.";
  const user = `Audit this item (marked answer ${q.correctOptionId}).\n${JSON.stringify({ scenario: q.scenario, stem: q.stem, options: q.options, correctOptionId: q.correctOptionId, explanation: q.explanation }, null, 2)}\n\n${FACTS}\n\nIs the marked answer the single best answer, every claim correct & CURRENT, unambiguous, and the explanation consistent with the options? Return <a>{"ok":true|false,"issues":["..."]}</a> (ok=true only if fully correct & current).`;
  try {
    return JSON.parse(grab(await ask(sys, user, 1000), "a"));
  } catch {
    return { ok: false, issues: ["reaudit parse failed"] };
  }
}

async function fixOne(q: Question, fix: Fix): Promise<{ id: string; q: Question; ok: boolean; issues: string[]; changed: boolean }> {
  if (fix.mode === "explanation") {
    const sys = "You revise a CCA-F question's explanation for currency. Output ONLY the revised explanation text in <e>...</e>, nothing else.";
    const user = `${FACTS}\n\nQUESTION (correct answer = ${q.correctOptionId}):\nScenario: ${q.scenario}\nStem: ${q.stem}\nOptions:\n${q.options.map((o) => `${o.id}. ${o.text}`).join("\n")}\nCurrent explanation: ${q.explanation}\n\nTASK: ${fix.directive}\nKeep it 2-5 sentences, still referencing options by letter, consistent with the unchanged options and correct answer ${q.correctOptionId}. Output ONLY <e>revised explanation</e>.`;
    const e = grab(await ask(sys, user, 900), "e");
    const updated = { ...q, explanation: e };
    const shape = questionShapeErrors(updated);
    if (shape.length) return { id: q.id, q, ok: false, issues: shape, changed: false };
    const a = await reaudit(updated);
    return { id: q.id, q: a.ok ? updated : q, ok: a.ok, issues: a.issues, changed: a.ok };
  }
  // rewrite mode: keep correctOptionId position to preserve the balanced key
  const sys = "You re-author one CCA-F question. Output ONLY one JSON object in <q>...</q>.";
  const target = q.correctOptionId;
  const user = `${FACTS}\n\nORIGINAL (domain ${q.domainKey}, scenario ${q.scenarioKey}):\nScenario: ${q.scenario}\nStem: ${q.stem}\nOptions:\n${q.options.map((o) => `${o.id}. ${o.text}`).join("\n")}\nCorrect: ${q.correctOptionId}\nExplanation: ${q.explanation}\n\nTASK: ${fix.directive}\nThe SINGLE correct answer MUST stay at option ${target} (keep the answer key balanced). The other three are plausible-but-wrong (one should be the now-removed prefill technique). Distractor-aware explanation referencing letters; everything CURRENT. Output ONLY <q>{"scenario":"...","stem":"...","options":[{"id":"A","text":"..."},{"id":"B","text":"..."},{"id":"C","text":"..."},{"id":"D","text":"..."}],"correctOptionId":"${target}","explanation":"...","topic":"..."}</q>`;
  let raw: { scenario: string; stem: string; options: { id: "A" | "B" | "C" | "D"; text: string }[]; correctOptionId: "A" | "B" | "C" | "D"; explanation: string; topic?: string };
  try {
    raw = JSON.parse(grab(await ask(sys, user, 1600), "q"));
  } catch {
    return { id: q.id, q, ok: false, issues: ["rewrite JSON parse failed"], changed: false };
  }
  const updated: Question = { ...q, scenario: raw.scenario, stem: raw.stem, options: raw.options, correctOptionId: raw.correctOptionId, explanation: raw.explanation, topic: raw.topic || q.topic };
  const shape = questionShapeErrors(updated);
  if (updated.correctOptionId !== target) shape.push(`correctOptionId must stay ${target}`);
  if (shape.length) return { id: q.id, q, ok: false, issues: shape, changed: false };
  const a = await reaudit(updated);
  return { id: q.id, q: a.ok ? updated : q, ok: a.ok, issues: a.issues, changed: a.ok };
}

async function main() {
  const qPath = resolve(root, "data/questions.json");
  const bank: Question[] = JSON.parse(readFileSync(qPath, "utf8"));
  const byId = new Map(bank.map((q) => [q.id, q]));
  console.log(`fixing ${FIXES.length} flagged items…`);
  const results = await pool(FIXES, CONCURRENCY, async (fix) => {
    const q = byId.get(fix.id);
    if (!q) return { id: fix.id, q: null as unknown as Question, ok: false, issues: ["id not found"], changed: false };
    const r = await fixOne(q, fix);
    console.log(`  ${fix.id}: ${r.changed ? "fixed" : "UNCHANGED"} ${r.ok ? "" : "(" + (r.issues[0] || "") + ")"}`);
    return r;
  });
  const fixed = results.filter((r) => r.changed);
  for (const r of fixed) byId.set(r.id, r.q);
  const merged = bank.map((q) => byId.get(q.id)!);
  const dist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
  for (const q of merged) dist[q.correctOptionId]++;
  console.log(`\nfixed ${fixed.length}/${FIXES.length}; answer-position dist ${JSON.stringify(dist)}`);
  const stillBad = results.filter((r) => !r.changed);
  if (stillBad.length) console.log("not applied:", stillBad.map((r) => r.id + " (" + (r.issues[0] || "") + ")").join("; "));
  const WRITE = process.argv.includes("--write");
  if (WRITE) {
    writeFileSync(qPath, JSON.stringify(merged, null, 2) + "\n");
    console.log(`WROTE ${qPath}`);
  } else console.log("(dry run, pass --write)");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
