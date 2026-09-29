import { NextRequest } from "next/server";
import { expect, it } from "vitest";
import { proxy } from "@/proxy";

it("refuses a foreign Host", () => {
  const r = proxy(new NextRequest("http://127.0.0.1:8766/", { headers: { host: "evil.example" } }));
  expect(r.status).toBe(403);
});

it("forbids framing by other sites (clickjacking), allows its own file viewer", () => {
  const r = proxy(new NextRequest("http://127.0.0.1:8766/", { headers: { host: "127.0.0.1:8766" } }));
  expect(r.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
  expect(r.headers.get("Content-Security-Policy")).toBe("frame-ancestors 'self'");
});
