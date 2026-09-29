import { sessions } from "@/lib/cockpit";

export async function GET(): Promise<Response> {
  try {
    return Response.json(await sessions());
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
