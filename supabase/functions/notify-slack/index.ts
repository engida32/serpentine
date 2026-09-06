// Delivers new feedback / bug / crash rows to your Slack group.
//
// Triggered by a Supabase Database Webhook (dashboard → Database →
// Webhooks → create, on INSERT to public.feedback → POST to
// `https://<project-ref>.functions.supabase.co/notify-slack` with header
// `Authorization: Bearer <ANON_KEY>`).
//
// Deploy with:
//   supabase functions deploy notify-slack --no-verify-jwt
//   supabase secrets set SLACK_WEBHOOK_URL=<incoming-webhook-url>
//
// Slack Incoming Webhook: https://api.slack.com/apps → "Incoming Webhooks",
// or in your Slack Workspace: Settings & administration → Manage apps → add
// "Incoming WebHooks" → create on the #arcade channel → copy URL.

const SLACK_URL = Deno.env.get("SLACK_WEBHOOK_URL") ?? "";

const KIND_ICON: Record<string, string> = {
  feedback: ":sparkles:",
  issue: ":bug:",
  crash: ":rotating_light:",
};

Deno.serve(async (req) => {
  if (!SLACK_URL) {
    console.error("SLACK_WEBHOOK_URL is not set");
    return new Response("missing SLACK_WEBHOOK_URL", { status: 500 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* webhook may POST without a body */
  }

  // Database webhook payload: { type, table, schema, record, old_record }.
  const rec = (body.record ?? body) as Record<string, unknown>;
  const kind = String(rec.type ?? "feedback");
  const message = String(rec.message ?? "(no message)");
  const name = rec.name ? ` by **${rec.name}**` : "";
  const game = rec.game ? ` · \`${rec.game}\`` : "";
  const url = rec.url ? ` · ${rec.url}` : "";
  const ts = rec.created_at ? String(rec.created_at) : new Date().toISOString();

  const text = `*${KIND_ICON[kind] ?? ":grey_exclamation:"} ${kind.toUpperCase()}*${name}${game}${url}\n<${ts}|${ts}> · ${message}`;

  try {
    const res = await fetch(SLACK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) console.error("slack webhook rejected", await res.text());
    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("slack relay failed", err);
    return new Response("slack relay failed", { status: 502 });
  }
});