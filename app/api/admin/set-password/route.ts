import { upsertEdgeConfigItems } from "@/lib/edgeConfigWrite";

// Lets a non-technical admin rotate the visitor-facing password (see
// app/admin/page.tsx) without ever touching code or triggering a redeploy --
// the new value is written straight into the Edge Config store that
// app/api/check-password/route.ts reads from, so it takes effect
// immediately for anyone hitting the site.
export async function POST(request: Request) {
  const { adminKey, newPassword } = await request.json();

  if (typeof adminKey !== "string" || adminKey !== process.env.ADMIN_KEY) {
    return Response.json({ ok: false, message: "Wrong admin key." }, { status: 401 });
  }
  if (typeof newPassword !== "string" || newPassword.trim().length < 4) {
    return Response.json({ ok: false, message: "New password must be at least 4 characters." }, { status: 400 });
  }

  const result = await upsertEdgeConfigItems([{ key: "sitePassword", value: newPassword.trim() }]);
  return Response.json(result, { status: result.ok ? 200 : 502 });
}
