import { getRun } from "@/lib/repo";

export const dynamic = "force-dynamic";

// GET /api/runs/<run_id> -> run.json, evaluator.json, proof.json, receipt.json, events.jsonl
export async function GET(request, { params }) {
  const { id } = await params;
  const run = getRun(id);
  if (!run) return Response.json({ error: `run ${id} not found` }, { status: 404 });
  return Response.json(run);
}
