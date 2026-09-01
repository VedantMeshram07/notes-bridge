// test-pipeline.mjs
// Runs the full pipeline once: question -> email-agent (Planner -> Retrieval
// -> Draft -> Critic -> Reviser) -> send-email. Prints every stage, so this
// doubles as a demo trace you can paste into your README/report.
//
// Usage:
//   node test-pipeline.mjs "your question here" "recipient@email.com"

const BASE_URL = "https://ttixfaajiwhtmylmcduc.functions.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_7sn2F_9ASXQRdAvcN8r9rA_va0xWGVW"; // this is the client-safe key, fine to hardcode

const question = process.argv[2] || "Summarize AURA's crisis detection agents";
const recipient = process.argv[3];

if (!recipient) {
  console.error('Usage: node test-pipeline.mjs "your question" "recipient@email.com"');
  process.exit(1);
}

async function callFunction(name, body) {
  const res = await fetch(`${BASE_URL}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${name} failed: ${JSON.stringify(data)}`);
  return data;
}

async function run() {
  console.log("=".repeat(60));
  console.log(`QUESTION: ${question}`);
  console.log("=".repeat(60));

  console.log("\n--- Step 1: email-agent (Planner -> Retrieval -> Draft -> Critic -> Reviser) ---\n");
  const agentResult = await callFunction("email-agent", { question });

  console.log("Sub-questions:", agentResult.subQuestions);
  console.log("Revisions needed:", agentResult.revisionCount);
  console.log("Sources used:", agentResult.sources.length);
  console.log("Final verification:", agentResult.verification);
  console.log("\nDraft subject:", agentResult.draft.subject);
  console.log("Draft body:\n", agentResult.draft.body);

  console.log("\n--- Step 2: send-email (only runs after the draft above) ---\n");
  const sendResult = await callFunction("send-email", {
    to: recipient,
    subject: agentResult.draft.subject,
    body: agentResult.draft.body,
  });

  console.log("Send result:", sendResult);
  console.log("\n" + "=".repeat(60));
  console.log("PIPELINE COMPLETE — check the inbox at", recipient);
  console.log("=".repeat(60));
}

run().catch((err) => {
  console.error("Pipeline failed:", err.message);
  process.exit(1);
});
