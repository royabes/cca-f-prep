import { describe, expect, it, vi } from "vitest";
import { buildUsagePayload, postUsage } from "./usage-ingest";

describe("usage ingest", () => {
  it("builds a priced-later payload from a Claude usage block", () => {
    const p = buildUsagePayload({ model: "claude-haiku-4-5", usage: { input_tokens: 1200, output_tokens: 300, cache_read_input_tokens: null }, latencyMs: 812.4, ctx: { visitor_id: "v", page: "/tutor" }, mode: "chat" });
    expect(p).toMatchObject({ feature: "cca-tutor", provider: "anthropic", model: "claude-haiku-4-5", input_tokens: 1200, output_tokens: 300, cache_read_tokens: 0, status: "ok", latency_ms: 812, meta: { mode: "chat" } });
  });

  it("tolerates a missing usage block", () => {
    const p = buildUsagePayload({ model: "m", usage: null, latencyMs: -5, ctx: {} });
    expect(p.input_tokens).toBe(0);
    expect(p.latency_ms).toBe(0);
  });

  it("skips without a token and never throws on network failure", async () => {
    const payload = buildUsagePayload({ model: "m", usage: null, latencyMs: 1, ctx: {} });
    delete process.env.USAGE_INGEST_TOKEN;
    expect(await postUsage(payload, vi.fn() as unknown as typeof fetch)).toBe(false);
    process.env.USAGE_INGEST_TOKEN = "t";
    const failing = vi.fn().mockRejectedValue(new Error("down")) as unknown as typeof fetch;
    expect(await postUsage(payload, failing)).toBe(false);
    const ok = vi.fn().mockResolvedValue({ ok: true, status: 200 }) as unknown as typeof fetch;
    expect(await postUsage(payload, ok)).toBe(true);
    const [, init] = (ok as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect((init as RequestInit).headers).toMatchObject({ authorization: "Bearer t" });
    delete process.env.USAGE_INGEST_TOKEN;
  });
});
