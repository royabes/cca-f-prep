// Author NEW original CCA-F questions to fill researched competency gaps, each
// at a pre-assigned (balanced) correct-answer position, then adversarially
// verify each against CURRENT documented Anthropic behavior. Controlled
// concurrency + backoff (the approach that ran clean for the debias rewrite).
// Writes /tmp/ccaf-new-questions.json (accepted) + /tmp/ccaf-gen-report.json.
// Run: npx tsx scripts/gen-questions.ts
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type { Question } from "../lib/types";
import { assignBalancedTargets, questionShapeErrors } from "./integrate";

const MODEL = "claude-opus-4-8";
const CONCURRENCY = 3;
const MAX_ATTEMPTS = 3;
type OptId = "A" | "B" | "C" | "D";

function apiKey(): string {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  const f = resolve(homedir(), ".anthropic_api_key");
  if (existsSync(f)) return readFileSync(f, "utf8").trim();
  throw new Error("no ANTHROPIC_API_KEY");
}
const client = new Anthropic({ apiKey: apiKey() });
const root = resolve(import.meta.dirname, "..");

const CURRENT_FACTS = `CURRENT, DOCUMENTED ANTHROPIC FACTS (the exam is closed-book on CURRENT behavior — never write a stale claim as correct):
- Model IDs are bare, never date-suffixed: claude-opus-4-8, claude-opus-4-7, claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5 (and claude-fable-5). NEVER "claude-*-YYYYMMDD".
- Assistant PREFILLING is REMOVED on the 4.6+ family (Opus 4.6/4.7/4.8, Sonnet 4.6, Fable 5): it returns HTTP 400. Use output_config.format or system-prompt instructions to steer format. Prefill is only valid as a legacy/older-model technique.
- Context window: current Opus/Sonnet/Fable default to 1M tokens; Haiku 4.5 is 200K. Do NOT assert a universal 200K window. Overflow surfaces as stop_reason "model_context_window_exceeded".
- Structured output: use output_config:{format:{type:"json_schema",...}} (constrained decoding) and/or strict:true tool use. The old output_format parameter is DEPRECATED. tool_use-for-JSON still works but is the older pattern.
- Thinking: adaptive thinking (thinking:{type:"adaptive"}) + output_config.effort (low/medium/high/xhigh/max). budget_tokens is deprecated on 4.6+.
- stop_reason set: end_turn, tool_use, max_tokens, stop_sequence, pause_turn, refusal, model_context_window_exceeded. NEVER detect completion by text-parsing the content. The "refusal" stop_reason is HTTP 200 with empty/partial content.
- Tool round trip: parse tool_use -> execute -> return tool_result; tool errors via is_error on the tool_result; NEVER put text blocks after tool_result blocks in the same turn. tool_choice values: auto | any | tool (forced) | none.
- Client tools (you execute) vs server tools Anthropic executes (web_search, web_fetch, code_execution, tool_search).
- MCP: host/client/server; initialize handshake negotiates capabilities; primitives = tools, resources, prompts (server) and sampling, elicitation, logging (client); transports = stdio and Streamable HTTP/SSE. WebSocket is NOT an MCP transport (good distractor, never correct).
- Prompt caching: <=4 cache_control breakpoints; ~1024-token minimum cacheable prefix; render order tools->system->messages; reads ~0.1x, writes ~1.25x(5m)/2x(1h); verify via usage.cache_read_input_tokens.
- Claude Code: CLAUDE.md is injected context (not enforced config); precedence managed-policy > user(~/.claude) > project(./ or ./.claude) > local; hooks are deterministic enforcement (exit 2 blocks, JSON decision control); .claude/rules/ supports path-scoped rules (YAML paths frontmatter + globs); skills are description-triggered/progressive-disclosure; headless mode is claude -p with JSON output.
- Batch API ~50% cheaper, async. Server-side compaction is BETA and requires appending full response.content across turns.`;

const SCENARIOS: Record<string, string> = {
  support: "Customer Support Resolution Agent",
  codegen: "Code Generation with Claude Code",
  research: "Multi-Agent Research System",
  devprod: "Developer Productivity with Claude",
  cicd: "Claude Code for CI/CD",
  extraction: "Structured Data Extraction",
};
const DOMAIN_TITLES: Record<string, string> = {
  agentic: "Agentic Architecture & Orchestration",
  claudecode: "Claude Code Configuration & Workflows",
  prompt: "Prompt Engineering & Structured Output",
  tools: "Tool Design & MCP Integration",
  context: "Context Management & Reliability",
};

type Spec = { domainKey: string; scenarioKey: string; difficulty: "easy" | "medium" | "hard"; competency: string; angle: string };

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
async function ask(system: string, user: string, maxTokens: number): Promise<string> {
  const msg = await withRetry(() => client.messages.create({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }));
  return msg.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
}
function extract(text: string, tag: string): string {
  const m = text.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  return (m ? m[1] : text).trim();
}
async function pool<I, O>(items: I[], n: number, worker: (item: I, i: number) => Promise<O>): Promise<O[]> {
  const out: O[] = new Array(items.length);
  let i = 0,
    done = 0;
  const run = async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await worker(items[idx], idx);
      if (++done % 5 === 0 || done === items.length) console.log(`  ${done}/${items.length}`);
    }
  };
  await Promise.all(Array.from({ length: n }, run));
  return out;
}

async function planSpecs(synthesis: unknown, currentTopics: string): Promise<Spec[]> {
  const sys = "You plan an item-writing batch for the Anthropic CCA-F certification. Output ONLY a JSON array wrapped in <specs>...</specs>.";
  const user = `From this research (competency map, prioritized gaps, per-domain proposed counts, de-dup guidance, staleness rules), produce a JSON array of EXACTLY 67 question specs to author.

RESEARCH:
${JSON.stringify(synthesis)}

OUR CURRENT TOPIC COVERAGE (avoid the over-saturated clusters named in the de-dup guidance):
${currentTopics}

Each spec: {"domainKey":"agentic|claudecode|prompt|tools|context","scenarioKey":"support|codegen|research|devprod|cicd|extraction","difficulty":"easy|medium|hard","competency":"<short competency from the map/gaps>","angle":"<the specific decision/distinction this one question tests — concrete, distinct from every other spec>"}.

Rules:
- Per-domain totals MUST match proposedCounts (agentic 19, claudecode 8, prompt 18, tools 12, context 10 = 67).
- Cover EVERY prioritized gap at least its suggestedCount; spend the rest deepening the competency map WITHOUT duplicating our saturated clusters (agents-vs-workflows, model-selection, tool_use-for-JSON, lost-in-the-middle).
- Distribute scenarioKey roughly evenly across the 6 scenarios (~11 each) so the mock-exam scenario rotation stays balanced; pick a scenario that fits each competency naturally.
- Lean medium/hard; a few easy only for brand-new mechanism recall (tool_choice values, stop_reason names).
- Every angle must be DISTINCT. Output ONLY the JSON array in <specs></specs>.`;
  const text = await ask(sys, user, 16000);
  const specs: Spec[] = JSON.parse(extract(text, "specs"));
  return specs;
}

const GEN_SYS =
  "You are an expert item-writer for the Anthropic Claude Certified Architect — Foundations (CCA-F) exam. You write ORIGINAL, scenario-based, single-best-answer multiple-choice questions grounded ONLY in current, documented Anthropic behavior. Never copy or paraphrase any existing question. Output ONLY one JSON object wrapped in <q>...</q>.";

function genPrompt(spec: Spec, target: OptId, prevIssues: string[] | null): string {
  const retry = prevIssues && prevIssues.length ? `\n\nYour previous attempt FAILED review:\n${prevIssues.map((s) => "- " + s).join("\n")}\nFix these.` : "";
  return `Write ONE original CCA-F question.
Domain: ${spec.domainKey} — ${DOMAIN_TITLES[spec.domainKey]}
Scenario framing: ${spec.scenarioKey} — ${SCENARIOS[spec.scenarioKey]}
Competency: ${spec.competency}
Specific angle to test: ${spec.angle}
Difficulty: ${spec.difficulty}

${CURRENT_FACTS}

Requirements:
- "scenario": 1-3 sentences, a realistic production situation in the ${spec.scenarioKey} setting with a clear goal/constraint.
- "stem": the question being asked.
- Exactly four options A,B,C,D. The SINGLE correct answer MUST be option ${target}. The other three are plausible-but-wrong real-world anti-patterns (not absurd, not second-correct).
- "correctOptionId": "${target}".
- "explanation": 2-5 sentences — why ${target} is correct AND why each of the other three is wrong, referring to options by their letter.
- "topic": a 2-5 word tag.
- Single best answer; no "all of the above"; no ambiguity; everything factually CURRENT.${retry}

Output ONLY: <q>{"scenario":"...","stem":"...","options":[{"id":"A","text":"..."},{"id":"B","text":"..."},{"id":"C","text":"..."},{"id":"D","text":"..."}],"correctOptionId":"${target}","explanation":"...","topic":"..."}</q>`;
}

const VERIFY_SYS = "You are a ruthless CCA-F exam reviewer. Assume the question is flawed until proven otherwise. Verify against CURRENT documented Anthropic behavior. Output ONLY JSON wrapped in <v>...</v>.";

function verifyPrompt(q: Question, existingTopics: string): string {
  return `Review this candidate question (its marked correct answer is ${q.correctOptionId}).

${JSON.stringify({ domainKey: q.domainKey, scenario: q.scenario, stem: q.stem, options: q.options, correctOptionId: q.correctOptionId, explanation: q.explanation }, null, 2)}

${CURRENT_FACTS}

Existing topics already in the bank (reject near-duplicates):
${existingTopics}

Check ALL, assuming flawed until proven right:
1. The marked answer ${q.correctOptionId} is the UNAMBIGUOUS single best answer per current documented behavior.
2. The other three options are each clearly suboptimal/wrong — plausible distractors, NOT a second defensible answer.
3. EVERY factual claim (in stem, options, explanation) is correct AND current — flag any stale claim (prefill-as-valid, universal-200K, output_format, budget_tokens, WebSocket-MCP, date-suffixed model ids, text-parsing for completion, etc.).
4. Scenario fits its setting and is realistic; no trick/ambiguous wording.
5. Explanation is correct and references the right option letters.
6. Not a near-duplicate of an existing topic.

Return ONLY: <v>{"ok":true|false,"fatal":true|false,"issues":["..."]}</v>  (ok=true only if ALL hold; fatal=true if unfixable -> discard.)`;
}

type Accepted = { question: Question; spec: Spec; attempts: number; aReview: { ok: boolean; issues: string[] } };
type Rejected = { spec: Spec; reason: string; issues: string[]; lastDraft?: Question };

async function makeOne(spec: Spec, target: OptId, existingTopics: string): Promise<Accepted | Rejected> {
  let prevIssues: string[] | null = null;
  let lastDraft: Question | undefined;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let draft: Question;
    try {
      const raw = JSON.parse(extract(await ask(GEN_SYS, genPrompt(spec, target, prevIssues), 2000), "q"));
      draft = {
        id: "PENDING",
        unitKind: "scenario",
        unitKey: spec.scenarioKey,
        domainKey: spec.domainKey as Question["domainKey"],
        scenarioKey: spec.scenarioKey,
        topic: String(raw.topic || spec.competency).slice(0, 60),
        difficulty: spec.difficulty,
        scenario: String(raw.scenario),
        stem: String(raw.stem),
        options: raw.options,
        correctOptionId: raw.correctOptionId,
        explanation: String(raw.explanation),
      };
    } catch (e) {
      prevIssues = ["previous output was not valid JSON in <q></q>"];
      continue;
    }
    lastDraft = draft;
    const shape = questionShapeErrors(draft);
    if (draft.correctOptionId !== target) shape.push(`correctOptionId must be ${target}`);
    if (shape.length) {
      prevIssues = shape;
      continue;
    }
    const v = JSON.parse(extract(await ask(VERIFY_SYS, verifyPrompt(draft, existingTopics), 1200), "v")) as { ok: boolean; fatal?: boolean; issues?: string[] };
    if (v.ok) return { question: draft, spec, attempts: attempt, aReview: { ok: true, issues: v.issues || [] } };
    if (v.fatal) return { spec, reason: "fatal", issues: v.issues || [], lastDraft: draft };
    prevIssues = v.issues || ["failed review"];
  }
  return { spec, reason: "max-attempts", issues: prevIssues || [], lastDraft };
}

async function main() {
  const REDO = "/tmp/ccaf-redo-specs.json";
  const NEWQ = "/tmp/ccaf-new-questions.json";
  const synthesis = JSON.parse(readFileSync("/tmp/ccaf-research.json", "utf8"));
  const bank: Question[] = JSON.parse(readFileSync(resolve(root, "data/questions.json"), "utf8"));
  const topicsByDomain: Record<string, string[]> = {};
  for (const q of bank) (topicsByDomain[q.domainKey] = topicsByDomain[q.domainKey] || []).push(q.topic);
  const currentTopics = Object.entries(topicsByDomain).map(([d, ts]) => `${d}: ${[...new Set(ts)].join("; ")}`).join("\n");

  // Redo mode: regenerate a hand-picked set of specs, appending to prior accepted.
  let priorAccepted: Question[] = [];
  let specs: Spec[];
  if (existsSync(REDO)) {
    specs = JSON.parse(readFileSync(REDO, "utf8"));
    priorAccepted = existsSync(NEWQ) ? JSON.parse(readFileSync(NEWQ, "utf8")) : [];
    console.log(`REDO: ${specs.length} specs; ${priorAccepted.length} already accepted`);
  } else {
    console.log("planning specs…");
    specs = await planSpecs(synthesis, currentTopics);
    writeFileSync("/tmp/ccaf-specs.json", JSON.stringify(specs, null, 2));
  }
  console.log(`generating ${specs.length} (concurrency ${CONCURRENCY})…`);

  // Balance targets across the bank PLUS anything already accepted.
  const dist: Record<OptId, number> = { A: 0, B: 0, C: 0, D: 0 };
  for (const q of [...bank, ...priorAccepted]) dist[q.correctOptionId]++;
  const targets = assignBalancedTargets(dist, specs.length);
  const results = await pool(specs, CONCURRENCY, (spec, i) => makeOne(spec, targets[i], currentTopics.split("\n").join(" ")));

  const accepted = results.filter((r): r is Accepted => "question" in r);
  const rejected = results.filter((r): r is Rejected => "reason" in r);
  const newAccepted = accepted.map((a) => ({ ...a.question, _spec: a.spec, _attempts: a.attempts }) as Question);
  writeFileSync(NEWQ, JSON.stringify([...priorAccepted, ...newAccepted], null, 2));
  writeFileSync("/tmp/ccaf-gen-report.json", JSON.stringify({ planned: specs.length, accepted: accepted.length, rejected: rejected.map((r) => ({ domain: r.spec.domainKey, competency: r.spec.competency, reason: r.reason, issues: r.issues })) }, null, 2));

  const accDist: Record<string, number> = {};
  for (const a of accepted) accDist[a.question.domainKey] = (accDist[a.question.domainKey] || 0) + 1;
  console.log(`\naccepted ${accepted.length}/${specs.length} | rejected ${rejected.length}`);
  console.log("accepted per domain:", JSON.stringify(accDist));
  console.log("wrote /tmp/ccaf-new-questions.json and /tmp/ccaf-gen-report.json");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
