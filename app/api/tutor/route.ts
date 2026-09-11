import { NextRequest, NextResponse } from "next/server";
import { readCtx } from "@/lib/attribution";
import { buildUsagePayload, postUsage } from "@/lib/usage-ingest";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

export const runtime = "nodejs";

const LEVEL_PERSONA: Record<string, string> = {
  newcomer:
    "The learner is NEW to the Claude ecosystem. Explain from first principles, define jargon, and keep it concrete. Avoid assuming prior API knowledge.",
  practitioner:
    "The learner has some hands-on Claude/API experience. Use correct terminology, be balanced in depth, and focus on the 'why'.",
  architect:
    "The learner designs production systems. Be terse and trade-off-focused. Skip basics; emphasize edge cases, failure modes, and when each option breaks.",
};

const BASE_SYSTEM =
  "You are an expert tutor for the Claude Certified Architect - Foundations (CCA-F) exam. " +
  "The exam covers five domains: Agentic Architecture & Orchestration, Claude Code Configuration & Workflows, " +
  "Prompt Engineering & Structured Output, Tool Design & MCP Integration, and Context Management & Reliability. " +
  "Be accurate, grounded in real Anthropic technology (Claude API, Agent SDK, Claude Code, MCP). " +
  "Never invent APIs. Teach architectural judgment and trade-offs, not trivia. " +
  "Format replies in light Markdown: short paragraphs, bullet lists for options, bold for key terms, no tables. " +
  "Never use em dashes; use commas, colons, or periods instead.";

function resolveApiKey(): string | null {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  // Local-first convenience fallback (works on the developer's machine).
  try {
    const key = readFileSync(join(homedir(), ".anthropic_api_key"), "utf8").trim();
    if (key) return key;
  } catch {
    /* no local key file */
  }
  return null;
}

// Abuse protection on a token-spending endpoint. NOTE: in-memory state is
// per-instance: fine for self-host / single instance; for a serverless deploy
// (e.g. Vercel) put a shared store (Upstash/Redis) or platform WAF in front.
const RATE_LIMIT = 30; // requests per window per client
const RATE_WINDOW_MS = 60_000;
const MAX_BODY_CHARS = 24_000; // hard cap on request body size
const buckets = new Map<string, { count: number; resetAt: number }>();

function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  return (xff ? xff.split(",")[0].trim() : "") || req.headers.get("x-real-ip") || "local";
}

// Returns seconds-to-wait if the client is over the limit, else null.
function rateLimitedFor(ip: string, now: number): number | null {
  const b = buckets.get(ip);
  if (!b || now > b.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return null;
  }
  if (b.count >= RATE_LIMIT) return Math.max(1, Math.ceil((b.resetAt - now) / 1000));
  b.count++;
  return null;
}

interface QuestionPayload {
  scenario?: string | null;
  stem: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
  explanation: string;
  topic?: string;
}

export async function POST(req: NextRequest) {
  // 1) Throttle first: cheapest rejection, protects even the no-key path.
  const retryAfter = rateLimitedFor(clientIp(req), Date.now());
  if (retryAfter !== null) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "retry-after": String(retryAfter) } });
  }

  // 2) Cap request size before parsing/spending tokens.
  const raw = await req.text();
  if (raw.length > MAX_BODY_CHARS) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

  const apiKey = resolveApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: "no_api_key" }, { status: 503 });
  }

  let body: {
    mode: "explain" | "chat";
    level?: string;
    question?: QuestionPayload;
    messages?: { role: "user" | "assistant"; content: string }[];
  };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const level = body.level && LEVEL_PERSONA[body.level] ? body.level : "practitioner";
  const persona = LEVEL_PERSONA[level];
  const client = new Anthropic({ apiKey });
  const model = process.env.TUTOR_MODEL || "claude-haiku-4-5";

  let system = `${BASE_SYSTEM}\n\nLEARNER LEVEL: ${persona}`;
  let messages: { role: "user" | "assistant"; content: string }[];

  if (body.mode === "explain" && body.question) {
    const q = body.question;
    const opts = q.options.map((o) => `${o.id}. ${o.text}`).join("\n");
    system +=
      "\n\nYou are explaining ONE practice question. In <=180 words: (1) tie it to the scenario, " +
      "(2) say plainly why the correct option is right, (3) name the trap in the most tempting wrong option, " +
      "(4) give one short memory hook. Use short paragraphs separated by blank lines. Do not use markdown headers.";
    messages = [
      {
        role: "user",
        content:
          `Topic: ${q.topic ?? "n/a"}\n` +
          (q.scenario ? `Scenario: ${q.scenario}\n` : "") +
          `Question: ${q.stem}\nOptions:\n${opts}\nCorrect answer: ${q.correctOptionId}\n` +
          `Reference explanation: ${q.explanation}\n\nNow coach me at my level.`,
      },
    ];
  } else if (body.mode === "chat" && body.messages?.length) {
    system +=
      "\n\nAnswer the learner's question conversationally and concisely. Offer a concrete example or a quick " +
      "practice question when helpful. Keep responses focused (a few short paragraphs).";
    messages = body.messages.slice(-12);
  } else {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  try {
    const llmStart = Date.now();
    const msg = await client.messages.create({
      model,
      max_tokens: 700,
      system,
      messages,
    });
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    await postUsage(
      buildUsagePayload({ model, usage: msg.usage ?? null, latencyMs: Date.now() - llmStart, ctx: readCtx(req), mode: body.mode }),
    );
    return NextResponse.json({ text, model, usage: { input_tokens: msg.usage?.input_tokens ?? 0, output_tokens: msg.usage?.output_tokens ?? 0 } });
  } catch (err) {
    // Log server-side only; never return raw provider/error detail to the client.
    console.error("[tutor] generation error:", err);
    return NextResponse.json({ error: "tutor_error" }, { status: 502 });
  }
}
