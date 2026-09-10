/**
 * Single-row sync endpoint backing the app's cloud copy of its data.
 * Never touches Supabase's publishable/anon key or RLS policies — this
 * function holds the secret key (Supabase's current full-privilege key,
 * SUPABASE_SECRET_KEY — the modern equivalent of the older service_role
 * key) server-side only, and is itself gated by a shared secret the client
 * sends, so no Supabase credential is ever shipped to the browser.
 * localStorage stays the fast, offline-first copy; this is just the
 * durable one that survives the browser clearing its own storage.
 */

const ROW_ID = "main";

function isAuthorized(req: any): boolean {
  const secret = req.headers["x-sync-secret"];
  return typeof secret === "string" && secret.length > 0 && secret === process.env.SYNC_SECRET;
}

function supabaseHeaders() {
  const key = process.env.SUPABASE_SECRET_KEY as string;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export default async function handler(req: any, res: any) {
  if (!isAuthorized(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const baseUrl = process.env.SUPABASE_URL as string;

  if (req.method === "GET") {
    const resp = await fetch(`${baseUrl}/rest/v1/app_data?id=eq.${ROW_ID}&select=data,updated_at`, {
      headers: supabaseHeaders(),
    });
    if (!resp.ok) {
      res.status(502).json({ error: "Upstream error" });
      return;
    }
    const rows = (await resp.json()) as { data: unknown; updated_at: string }[];
    if (rows.length === 0) {
      res.status(200).json({ data: null, updatedAt: null });
      return;
    }
    res.status(200).json({ data: rows[0].data, updatedAt: rows[0].updated_at });
    return;
  }

  if (req.method === "POST") {
    const { data } = req.body ?? {};
    if (data === undefined) {
      res.status(400).json({ error: "Missing data" });
      return;
    }
    const resp = await fetch(`${baseUrl}/rest/v1/app_data`, {
      method: "POST",
      headers: { ...supabaseHeaders(), Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify([{ id: ROW_ID, data, updated_at: new Date().toISOString() }]),
    });
    if (!resp.ok) {
      res.status(502).json({ error: "Upstream error" });
      return;
    }
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
