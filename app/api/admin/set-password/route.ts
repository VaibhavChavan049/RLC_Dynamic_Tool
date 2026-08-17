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

  const edgeConfigId = process.env.EDGE_CONFIG_ID;
  const apiToken = process.env.VERCEL_API_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;
  if (!edgeConfigId || !apiToken) {
    return Response.json(
      { ok: false, message: "Server isn't fully configured yet (missing VERCEL_API_TOKEN)." },
      { status: 500 }
    );
  }

  const url = new URL(`https://api.vercel.com/v1/edge-config/${edgeConfigId}/items`);
  if (teamId) url.searchParams.set("teamId", teamId);

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: [{ operation: "upsert", key: "sitePassword", value: newPassword.trim() }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return Response.json({ ok: false, message: `Vercel API error (${res.status}): ${detail}` }, { status: 502 });
  }

  return Response.json({ ok: true });
}
