// Adversarially audit EVERY question in the bank against current, documented
// Anthropic behavior and CCA-F competency alignment. Flags factual/stale errors,
// ambiguity / wrong-marked-answer, weak distractors, and off-blueprint items.
// Controlled concurrency + backoff. Writes /tmp/ccaf-audit.json. Read-only.
// Run: npx tsx scripts/audit-bank.ts
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type { Question } from "../lib/types";

const MODEL = "claude-opus-4-8";
const CONCURRENCY = 4;

function apiKey(): string {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  const f = resolve(homedir(), ".anthropic_api_key");
  if (existsSync(f)) return readFileSync(f, "utf8").trim();
  throw new Error("no ANTHROPIC_API_KEY");
}
const client = new Anthropic({ apiKey: apiKey() });
const root = resolve(import.meta.dirname, "..");

const CURRENT_FACTS = `CURRENT, DOCUMENTED ANTHROPIC FACTS (a correct answer must reflect CURRENT behavior):
- Bare model ids only: claude-opus-4-8/4-7/4-6, claude-sonnet-4-6, claude-haiku-4-5, claude-fable-5. Never date-suffixed.
- Assistant PREFILLING is REMOVED on the 4.6+ family (HTTP 400). Use output_config.format or system instructions. Prefill is legacy-only.
- Context window: Opus/Sonnet/Fable default 1M; Haiku 4.5 is 200K. No universal 200K. Overflow => stop_reason "model_context_window_exceeded".
- Structured output: output_config:{format:{type:"json_schema"}} (constrained decoding) and/or strict:true tool use. output_format param is DEPRECATED. tool_use-for-JSON is the older pattern.
- Thinking: adaptive (thinking:{type:"adaptive"}) + output_config.effort; budget_tokens deprecated on 4.6+.
- stop_reason set: end_turn, tool_use, max_tokens, stop_sequence, pause_turn, refusal, model_context_window_exceeded. Never text-parse for completion. refusal = HTTP 200, empty/partial content.
- tool_choice: auto|any|tool(forced)|none. Client tools (you run) vs server tools (web_search, web_fetch, code_execution, tool_search).
- MCP: initialize handshake negotiates capabilities; server primitives tools/resources/prompts; client primitives sampling/elicitation/logging; transports stdio + Streamable HTTP/SSE. WebSocket is NOT an MCP transport.
- Prompt caching: <=4 breakpoints; ~1024-token min prefix; order tools->system->messages; reads ~0.1x, writes ~1.25x(5m)/2x(1h); verify via cache_read_input_tokens.
- Claude Code: CLAUDE.md is injected context (precedence managed>user>project>local); hooks deterministic (exit 2 blocks); .claude/rules path-scoped; skills description-triggered; headless claude -p with JSON. Batch API ~50% cheaper async.`;

const SYS = "You are a meticulous CCA-F exam-item auditor. You verify each question against CURRENT documented Anthropic behavior and the certification blueprint. Be skeptical but fair: flag only genuine problems. Output ONLY JSON wrapped in <a>...</a>.";

function prompt(q: Question): string {
  return `Audit this existing exam item. Its marked correct answer is ${q.correctOptionId}.

${JSON.stringify({ id: q.id, domainKey: q.domainKey, scenarioKey: q.scenarioKey, difficulty: q.difficulty, scenario: q.scenario, stem: q.stem, options: q.options, correctOptionId: q.correctOptionId, explanation: q.explanation }, null, 2)}

${CURRENT_FACTS}

Assess:
1. CORRECTNESS: is the marked answer ${q.correctOptionId} truly the single best answer? Is any factual claim (stem/options/explanation) wrong?
2. CURRENCY: any STALE claim vs the facts above (prefill-as-valid, universal-200K, output_format, budget_tokens, WebSocket-MCP, date-suffixed ids, text-parsing completion, etc.)?
3. AMBIGUITY: is there a second defensible answer, or trick/unclear wording?
4. ALIGNMENT: does it test a real CCA-F competency in domain "${q.domainKey}", at an appropriate level (not trivia, not off-blueprint)?
5. DISTRACTORS: are the wrong options plausible-but-clearly-wrong (not absurd, not secretly correct)?

Return ONLY: <a>{"id":"${q.id}","ok":true|false,"severity":"none|low|medium|high","category":"correctness|currency|ambiguity|alignment|distractors|none","issues":["..."],"fix":"concrete suggested correction, or empty if ok"}</a>
ok=true and severity="none" only if the item is fully correct, current, unambiguous, and on-blueprint. Use high for a wrong/stale CORRECT answer; medium for a stale distractor/explanation or real ambiguity; low for minor wording.`;
}

function extract(text: string): string {
  const m = text.match(/<a>([\s\S]*?)<\/a>/i);
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
      const retryable = err?.status === 429 || err?.status === 529 || (err?.status ?? 0) >= 500 || /rate|overload|limit|timeout|ECONN/i.test(msg);
      if (a >= 6 || !retryable) throw e;
      await sleep(delay);
      delay = Math.min(delay * 2, 30000);
    }
  }
}
async function pool<I, O>(items: I[], n: number, worker: (item: I, i: number) => Promise<O>): Promise<O[]> {
  const out: O[] = new Array(items.length);
  let i = 0,
    done = 0;
  const run = async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await worker(items[idx], idx);
      if (++done % 20 === 0 || done === items.length) console.log(`  ${done}/${items.length}`);
    }
  };
  await Promise.all(Array.from({ length: n }, run));
  return out;
}

type Verdict = { id: string; ok: boolean; severity: string; category: string; issues: string[]; fix: string };

async function main() {
  const qs: Question[] = JSON.parse(readFileSync(resolve(root, "data/questions.json"), "utf8"));
  console.log(`auditing ${qs.length} questions (concurrency ${CONCURRENCY})…`);
  const verdicts = await pool(qs, CONCURRENCY, async (q): Promise<Verdict> => {
    try {
      const raw = await withRetry(() => client.messages.create({ model: MODEL, max_tokens: 1500, system: SYS, messages: [{ role: "user", content: prompt(q) }] }));
      const text = raw.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
      const v = JSON.parse(extract(text)) as Verdict;
      return { id: q.id, ok: !!v.ok, severity: v.severity || "none", category: v.category || "none", issues: v.issues || [], fix: v.fix || "" };
    } catch (e) {
      return { id: q.id, ok: false, severity: "low", category: "audit-error", issues: ["audit call failed: " + String((e as Error).message)], fix: "" };
    }
  });
  writeFileSync("/tmp/ccaf-audit.json", JSON.stringify(verdicts, null, 2));
  const flagged = verdicts.filter((v) => !v.ok || (v.severity !== "none" && v.severity !== "low"));
  const bySev: Record<string, number> = {};
  for (const v of verdicts) bySev[v.severity] = (bySev[v.severity] || 0) + 1;
  console.log(`\naudited ${verdicts.length} | severity ${JSON.stringify(bySev)}`);
  console.log(`flagged (not-ok or medium/high): ${flagged.length}`);
  for (const v of flagged) console.log(`  [${v.severity}/${v.category}] ${v.id}: ${(v.issues || []).slice(0, 2).join(" | ")}`);
  console.log("wrote /tmp/ccaf-audit.json");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
