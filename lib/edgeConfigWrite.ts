// Shared by every route that writes to the Edge Config store (visitor
// password, visit counter) -- the runtime @vercel/edge-config package only
// supports reads; writes go through this REST call instead, authenticated
// with a Vercel API token rather than the store's own read-only token.
export async function upsertEdgeConfigItems(
  items: { key: string; value: unknown }[]
): Promise<{ ok: boolean; message?: string }> {
  const edgeConfigId = process.env.EDGE_CONFIG_ID;
  const apiToken = process.env.VERCEL_API_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;
  if (!edgeConfigId || !apiToken) {
    return { ok: false, message: "Server isn't fully configured yet (missing VERCEL_API_TOKEN)." };
  }

  // Vercel's write API for this lives under /v1/global-config/ (the
  // product was renamed from "Edge Config" to "Global Config" -- reads via
  // @vercel/edge-config still work unchanged against the old domain, but
  // this REST endpoint moved and /v1/edge-config/ 404s).
  const url = new URL(`https://api.vercel.com/v1/global-config/${edgeConfigId}/items`);
  if (teamId) url.searchParams.set("teamId", teamId);

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: items.map(({ key, value }) => ({ operation: "upsert", key, value })),
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return { ok: false, message: `Vercel API error (${res.status}): ${detail}` };
  }
  return { ok: true };
}
