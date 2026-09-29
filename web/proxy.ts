import { NextResponse, type NextRequest } from "next/server";

// DNS-rebinding guard: a page on another domain that resolves to 127.0.0.1 reaches this server with its own
// Host header. Only loopback names are served; the port is not checked (the hostname alone defeats rebinding).
const LOCAL_HOST = /^(127\.0\.0\.1|localhost)(:\d+)?$/;

export function proxy(request: NextRequest): NextResponse {
  if (!LOCAL_HOST.test(request.headers.get("host") ?? "")) return new NextResponse("Host not allowed", { status: 403 });
  const response = NextResponse.next();
  // Clickjacking guard: other sites cannot frame the cockpit; its own file viewer still can.
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  // /api/file sets its own policy (sandbox + frame-ancestors): never override it here.
  if (!request.nextUrl.pathname.startsWith("/api/file")) response.headers.set("Content-Security-Policy", "frame-ancestors 'self'");
  return response;
}
