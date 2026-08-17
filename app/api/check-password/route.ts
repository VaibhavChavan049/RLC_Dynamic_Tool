import { get } from "@vercel/edge-config";

// The visitor-facing password lives in Edge Config (not in this repo) so
// the site's own /admin page can rotate it without a code change or
// redeploy -- see app/api/admin/set-password/route.ts, which is the only
// thing that ever writes this key.
export async function POST(request: Request) {
  const { password } = await request.json();
  const correctPassword = await get<string>("sitePassword");
  const ok = typeof password === "string" && typeof correctPassword === "string" && password === correctPassword;
  return Response.json({ ok });
}
