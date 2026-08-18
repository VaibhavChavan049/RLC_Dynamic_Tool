import { get } from "@vercel/edge-config";
import { upsertEdgeConfigItems } from "@/lib/edgeConfigWrite";

// Called once by PasswordGate right after a correct password unlocks the
// site -- a simple running total the boss can check on /admin without
// needing a Vercel login, as opposed to the full traffic breakdown in
// Vercel Web Analytics (dashboard-only, no simple free API to embed here).
// Not atomic (read-then-write), so a burst of simultaneous unlocks could
// undercount by a little -- an acceptable tradeoff for a low-traffic tool,
// not worth a dedicated counter service.
export async function POST() {
  const current = (await get<number>("visitCount")) ?? 0;
  const result = await upsertEdgeConfigItems([
    { key: "visitCount", value: current + 1 },
    { key: "lastVisitAt", value: new Date().toISOString() },
  ]);
  return Response.json(result, { status: result.ok ? 200 : 502 });
}
