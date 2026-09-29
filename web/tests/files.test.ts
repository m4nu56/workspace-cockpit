import { describe, expect, it } from "vitest";
import { isInside, render, securityHeaders } from "@/lib/files";

describe("render", () => {
  it.each([["a.md", "markdown"], ["R.HTML", "html"], ["x.pdf", "pdf"], ["p.png", "image"], ["d.csv", "csv"],
    ["s.sql", "text"], ["c.py", "text"], ["v.xlsx", "external"], ["no-extension", "text"], [".env", "text"]])("%s → %s", (n, e) => {
    expect(render(n)).toBe(e);
  });
});

describe("isInside", () => {
  it("accepts a file of the folder", () => expect(isInside("/w/p/a", "/w/p/a/x/y.md")).toBe(true));
  it("accepts a name starting with two dots", () => expect(isInside("/w/p/a", "/w/p/a/..notes.md")).toBe(true));
  it("refuses a sibling", () => expect(isInside("/w/p/a", "/w/p/ab/y.md")).toBe(false));
  it("refuses going up", () => expect(isInside("/w/p/a", "/w/p/a/../b/y.md")).toBe(false));
  it("refuses the folder itself", () => expect(isInside("/w/p/a", "/w/p/a")).toBe(false));
});

describe("securityHeaders", () => {
  it("sandboxes what can run script", () => {
    for (const n of ["r.html", "R.HTM", "x.svg"]) expect(securityHeaders(n)["Content-Security-Policy"]).toBe("sandbox allow-scripts; frame-ancestors 'self'");
  });
  it("does not sandbox a PDF", () => {
    expect(securityHeaders("x.pdf")["Content-Security-Policy"]).toBe("frame-ancestors 'self'");
    expect(securityHeaders("x.pdf")["X-Content-Type-Options"]).toBe("nosniff");
  });
});
