import { get } from "@vercel/edge-config";

// Gated behind the same admin key as set-password -- the count itself isn't
// especially sensitive, but keeping every /admin action behind one key
// (rather than making some fields public) is simpler to reason about.
export async function POST(request: Request) {
  const { adminKey } = await request.json();
  if (typeof adminKey !== "string" || adminKey !== process.env.ADMIN_KEY) {
    return Response.json({ ok: false, message: "Wrong admin key." }, { status: 401 });
  }

  const visitCount = (await get<number>("visitCount")) ?? 0;
  const lastVisitAt = (await get<string | null>("lastVisitAt")) ?? null;
  return Response.json({ ok: true, visitCount, lastVisitAt });
}
