/**
 * Next.js-side mirror of supabase/functions/_shared/usage.ts (pricing, normalization, cost).
 * The Deno module imports with a .ts extension, which the Next compiler rejects, so the two
 * tables are kept in step by tests/usage-report.test.ts.
 */
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 2.5, output: 10 },
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-sonnet-4-20250514': { input: 3, output: 15 },
  'claude-opus-4-5-20251101': { input: 15, output: 75 },
  'gpt-5.2': { input: 10, output: 30 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'claude-haiku-4-5': { input: 1, output: 5 },
  'claude-opus-5': { input: 5, output: 25 },
  'claude-opus-4-8': { input: 5, output: 25 },
  'text-embedding-3-small': { input: 0.02, output: 0 },
  default: { input: 3, output: 15 },
}

export type Provider = 'openai' | 'anthropic'

export interface UsageCtx {
  session_id?: string | null
  visitor_id?: string | null
  page?: string | null
  landing_path?: string | null
  referrer_host?: string | null
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  country?: string | null
  device?: string | null
}

export const CTX_KEYS: (keyof UsageCtx)[] = [
  'session_id', 'visitor_id', 'page', 'landing_path', 'referrer_host',
  'utm_source', 'utm_medium', 'utm_campaign', 'country', 'device',
]

export function normalizeUsage(raw: unknown): { input_tokens: number; output_tokens: number; cache_read_tokens: number } {
  const u = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const n = (k: string) => {
    const v = u[k]
    return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : 0
  }
  return {
    input_tokens: n('input_tokens') || n('prompt_tokens') || n('tokensInput'),
    output_tokens: n('output_tokens') || n('completion_tokens') || n('tokensOutput'),
    cache_read_tokens: n('cache_read_input_tokens') || n('cache_read_tokens'),
  }
}

export function costUsd(model: string, inputTokens: number, outputTokens: number, cacheReadTokens = 0): number {
  const key = Object.keys(MODEL_PRICING).find((k) => k !== 'default' && model.startsWith(k))
  const price = (key && MODEL_PRICING[key]) || MODEL_PRICING.default
  const cost =
    (inputTokens / 1_000_000) * price.input +
    (outputTokens / 1_000_000) * price.output +
    (cacheReadTokens / 1_000_000) * price.input * 0.1
  return Math.round(cost * 1_000_000) / 1_000_000
}

/** Picks a clean attribution object out of an untrusted payload. */
export function sanitizeCtx(src: unknown): UsageCtx {
  const out: UsageCtx = {}
  if (src && typeof src === 'object') {
    const o = src as Record<string, unknown>
    for (const k of CTX_KEYS) {
      const v = o[k]
      if (typeof v === 'string' && v.length > 0) out[k] = v.slice(0, 200)
    }
  }
  return out
}
