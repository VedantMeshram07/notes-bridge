// supabase/functions/send-email/index.ts
//
// Actually sends an email via Resend. This function has NO verification
// logic of its own -- it just sends whatever it's given. Call this ONLY
// after the user has reviewed and confirmed a draft from email-agent.
//
// Without a verified domain, Resend restricts you to sending FROM
// onboarding@resend.dev and TO the email address you signed up with.
// That's fine for a demo -- just use your own email as the recipient.

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

// CORS: without these headers, a browser (e.g. your Lovable app) blocks
// the request entirely before it even reaches this code. curl never hits
// this because CORS is a browser-only restriction.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  // Browsers send an OPTIONS preflight request before the real POST --
  // it must get a 200 with these headers, or the real request never fires.
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, body } = await req.json();
    if (!to || !subject || !body) {
      return new Response(
        JSON.stringify({ error: "Request body must include 'to', 'subject', and 'body'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Notes Bridge <onboarding@resend.dev>", // swap once you verify your own domain
        to: [to],
        subject,
        text: body,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(
        JSON.stringify({ error: `Resend error ${res.status}: ${errText}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await res.json();
    return new Response(JSON.stringify({ sent: true, id: data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
