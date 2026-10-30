import { listRuns } from "@/lib/repo";

export const dynamic = "force-dynamic";

// GET /api/runs -> one summary row per folder in ../runs and ../backup
export async function GET() {
  return Response.json({ runs: listRuns() });
}
