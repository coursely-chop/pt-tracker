/**
 * Daily Vercel Cron target (see vercel.json) whose only job is to touch the
 * Supabase database so a free-tier project never looks inactive enough to
 * get paused. Reads one row's id and returns nothing from it — no user data
 * leaves this function. Vercel sends `Authorization: Bearer $CRON_SECRET`
 * automatically when that env var is set; if it is, require it, otherwise
 * the endpoint is harmless enough to leave open.
 */
export default async function handler(req: any, res: any) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const key = process.env.SUPABASE_SECRET_KEY as string;
  const resp = await fetch(`${process.env.SUPABASE_URL}/rest/v1/app_data?select=id&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!resp.ok) {
    res.status(502).json({ error: "Upstream error" });
    return;
  }
  res.status(200).json({ ok: true });
}
