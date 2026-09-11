import type { UsageCtx } from "./usage-shared";

export interface UsagePayload {
  feature: "cca-tutor";
  provider: "anthropic";
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  status: "ok" | "error";
  latency_ms: number;
  ctx: UsageCtx;
  meta?: Record<string, unknown>;
}

/** Shapes one ledger row from a Claude reply. Pure. */
export function buildUsagePayload(args: {
  model: string;
  usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number | null } | null;
  latencyMs: number;
  ctx: UsageCtx;
  status?: "ok" | "error";
  mode?: string;
}): UsagePayload {
  const u = args.usage ?? {};
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : 0);
  return {
    feature: "cca-tutor",
    provider: "anthropic",
    model: args.model,
    input_tokens: n(u.input_tokens),
    output_tokens: n(u.output_tokens),
    cache_read_tokens: n(u.cache_read_input_tokens),
    status: args.status ?? "ok",
    latency_ms: Math.max(0, Math.round(args.latencyMs)),
    ctx: args.ctx,
    ...(args.mode ? { meta: { mode: args.mode } } : {}),
  };
}

/** Posts the row to the portfolio's ledger. Skips silently without a token; never throws. */
export async function postUsage(payload: UsagePayload, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const token = process.env.USAGE_INGEST_TOKEN;
  if (!token) return false;
  const url = process.env.USAGE_INGEST_URL || "https://royabes.com/api/usage";
  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) console.warn("[usage] ingest rejected", res.status);
    return res.ok;
  } catch (e) {
    console.warn("[usage] ingest failed", (e as Error).message);
    return false;
  }
}
