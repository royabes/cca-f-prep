import type { DomainKey, UserLevel } from "./types";

export interface DomainMeta {
  key: DomainKey;
  title: string;
  short: string;
  weight: number; // exam blueprint weight, %
  blurb: string;
  accent: string; // tailwind-friendly hex
}

// The official CCA-F blueprint (5 weighted domains).
export const DOMAINS: DomainMeta[] = [
  {
    key: "agentic",
    title: "Agentic Architecture & Orchestration",
    short: "Agentic Arch.",
    weight: 27,
    blurb:
      "The agentic loop, agents vs. workflows, task decomposition, orchestrator–subagent (hub-and-spoke), multi-agent topologies, the Agent SDK, hooks and guardrails.",
    accent: "#c2693f",
  },
  {
    key: "claudecode",
    title: "Claude Code Configuration & Workflows",
    short: "Claude Code",
    weight: 20,
    blurb:
      "CLAUDE.md hierarchy & precedence, slash commands, Agent Skills, subagents, hooks & exit codes, plan mode, the Claude Code SDK, CI/CD with the -p flag.",
    accent: "#3f7fc2",
  },
  {
    key: "prompt",
    title: "Prompt Engineering & Structured Output",
    short: "Prompt Eng.",
    weight: 20,
    blurb:
      "Explicit criteria, few-shot, tool_use for structured/JSON output, schema design, validation-retry loops, multi-pass review, XML sectioning.",
    accent: "#6a4fb3",
  },
  {
    key: "tools",
    title: "Tool Design & MCP Integration",
    short: "Tools & MCP",
    weight: 18,
    blurb:
      "Tool schema & description design, structured errors, least-privilege scoping, MCP servers and the three primitives (tools, resources, prompts), transports & auth.",
    accent: "#2f9e7e",
  },
  {
    key: "context",
    title: "Context Management & Reliability",
    short: "Context & Rel.",
    weight: 15,
    blurb:
      "Context windows & token budgeting, lost-in-the-middle, RAG (semantic/BM25/hybrid), prompt caching, the Batch API, escalation, error propagation, provenance.",
    accent: "#b3823f",
  },
];

export const DOMAIN_MAP: Record<DomainKey, DomainMeta> = DOMAINS.reduce(
  (acc, d) => {
    acc[d.key] = d;
    return acc;
  },
  {} as Record<DomainKey, DomainMeta>,
);

// Official exam logistics.
export const EXAM = {
  questionCount: 60,
  minutes: 120,
  scaleMin: 100,
  scaleMax: 1000,
  passScaled: 720,
  name: "Claude Certified Architect — Foundations",
  code: "CCA-F",
} as const;

export const SCENARIOS: { key: string; title: string }[] = [
  { key: "support", title: "Customer Support Resolution Agent" },
  { key: "codegen", title: "Code Generation with Claude Code" },
  { key: "research", title: "Multi-Agent Research System" },
  { key: "devprod", title: "Developer Productivity with Claude" },
  { key: "cicd", title: "Claude Code for CI/CD" },
  { key: "extraction", title: "Structured Data Extraction" },
];

export const LEVELS: { key: UserLevel; label: string; desc: string }[] = [
  {
    key: "newcomer",
    label: "Newcomer",
    desc: "New to the Claude ecosystem. Explanations start from first principles.",
  },
  {
    key: "practitioner",
    label: "Practitioner",
    desc: "Some hands-on Claude/API experience. Balanced depth.",
  },
  {
    key: "architect",
    label: "Architect",
    desc: "Designs production systems. Terse, trade-off-focused explanations.",
  },
];
