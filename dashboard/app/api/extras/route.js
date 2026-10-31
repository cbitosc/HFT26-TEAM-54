import { getExtras } from "@/lib/repo";

export const dynamic = "force-dynamic";

// GET /api/extras -> runs/benchmark.json (P1) and runs/cheats.json (P2)
export async function GET() {
  return Response.json(getExtras());
}
