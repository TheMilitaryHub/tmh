export async function onRequestPost({ request, env }) {
  const data = await request.json();
  const webhook = env.DISCORD_WEBHOOK_URL;

  const payload = {
    content: [
      "**New TMH Contact Submission**",
      `**Name/Handle:** ${data.name}`,
      `**Preferred Contact:** ${data.contactInfo}`,
      "**Message:**",
      data.message
    ].join("\n")
  };

  const resp = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  return new Response(
    resp.ok ? "ok" : "discord error",
    { status: resp.ok ? 200 : 500 }
  );
}
