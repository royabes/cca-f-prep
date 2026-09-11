import { describe, expect, it } from "vitest";
import { WHATS_NEW } from "./whats-new";

describe("what's new entries", () => {
  it("has at least one entry with a title and body", () => {
    expect(WHATS_NEW.length).toBeGreaterThan(0);
    for (const e of WHATS_NEW) {
      expect(e.title.trim().length).toBeGreaterThan(3);
      expect(e.body.trim().length).toBeGreaterThan(20);
    }
  });

  it("uses valid ISO dates, newest first", () => {
    const stamps = WHATS_NEW.map((e) => {
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const t = Date.parse(e.date);
      expect(Number.isNaN(t)).toBe(false);
      return t;
    });
    for (let i = 1; i < stamps.length; i++) expect(stamps[i - 1]).toBeGreaterThanOrEqual(stamps[i]);
  });

  it("links are absolute https or site-relative, and always carry a label", () => {
    for (const e of WHATS_NEW) {
      if (e.href) {
        expect(e.href).toMatch(/^(https:\/\/|\/)/);
        expect(e.label?.trim().length ?? 0).toBeGreaterThan(0);
      }
    }
  });

  it("never uses an em dash", () => {
    for (const e of WHATS_NEW) expect(`${e.title} ${e.body}`).not.toContain("—");
  });
});
