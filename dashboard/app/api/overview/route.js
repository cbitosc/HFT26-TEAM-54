import { getCheatsWithSource, getMemoryRuns } from "@/lib/repo";

export const dynamic = "force-dynamic";

// GET /api/overview -> cheats (with which folder they came from) + runs that used on-chain memory.
// New route for the Overview tab; /api/runs, /api/extras and /api/chain are unchanged.
export async function GET() {
  return Response.json({ cheats: getCheatsWithSource(), memory_runs: getMemoryRuns() });
}
