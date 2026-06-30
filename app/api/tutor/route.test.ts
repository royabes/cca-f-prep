import { describe, it, expect, vi, beforeEach } from "vitest";

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: createMock };
  },
}));

import { POST } from "./route";
import { NextRequest } from "next/server";

function req(body: unknown, ip = "10.0.0.1") {
  return new NextRequest("http://localhost/api/tutor", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
const chat = (content = "How do subagents isolate context?") => ({ mode: "chat", messages: [{ role: "user", content }] });

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  delete process.env.TUTOR_MODEL;
  createMock.mockReset();
  createMock.mockResolvedValue({ content: [{ type: "text", text: "an answer" }] });
});

describe("tutor route hardening", () => {
  it("uses the canonical un-suffixed Haiku model id by default", async () => {
    const res = await POST(req(chat(), "ip-model"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.model).toBe("claude-haiku-4-5");
  });

  it("does not leak raw SDK error detail to the client", async () => {
    createMock.mockRejectedValue(new Error("anthropic internal: key sk-ant-xxx quota detail"));
    const res = await POST(req(chat(), "ip-error"));
    const json = await res.json();
    expect(res.status).toBe(502);
    expect(json.error).toBe("tutor_error");
    expect(json.detail).toBeUndefined();
    expect(JSON.stringify(json)).not.toMatch(/sk-ant|quota detail|internal/i);
  });

  it("rate-limits a single client after a threshold (429)", async () => {
    const ip = "ip-flood";
    let last: Response | undefined;
    for (let i = 0; i < 40; i++) last = await POST(req(chat(), ip));
    expect(last!.status).toBe(429);
    expect(last!.headers.get("retry-after")).toBeTruthy();
  });

  it("rejects an oversized payload (413) without calling the model", async () => {
    const huge = "x".repeat(60_000);
    const res = await POST(req(chat(huge), "ip-huge"));
    expect(res.status).toBe(413);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("still rejects malformed JSON with 400", async () => {
    const res = await POST(req("{not json", "ip-bad"));
    expect(res.status).toBe(400);
  });
});
