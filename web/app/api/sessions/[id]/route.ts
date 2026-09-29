import { CockpitError, sessionDetail } from "@/lib/cockpit";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  try {
    return Response.json(await sessionDetail(id));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: e instanceof CockpitError ? 404 : 500 });
  }
}
