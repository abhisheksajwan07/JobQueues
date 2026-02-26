// src/test/test.email.ts
// Terminal 1: npx ts-node src/queue/worker.ts
// Terminal 2: npx ts-node src/test/test.email.ts <test>
//
// tests:
//   single       — 1 valid email job
//   invalid      — missing fields, should fail with no retry
//   concurrent   — 20 emails at once, all 5 workers busy

import { enqueue } from "../queue/enqueue";

const test = process.argv[2] ?? "single";

async function run() {
  // ── single ──────────────────────────────────────────────────────────────
  if (test === "single") {
    console.log("\n[TEST] single email job");
    console.log("Expected: picks up in <1s, sends, logs success");
    console.log("20% chance of SMTP failure → auto retries\n");

    const job = await enqueue("send_email", {
      to: "user@example.com",
      subject: "Welcome to the app",
      body: "Hey, thanks for signing up!",
    });

    console.log(`Enqueued job #${job.id}`);
    console.log("Watch Terminal 1 for worker logs...");
  }

  // ── invalid ─────────────────────────────────────────────────────────────
  if (test === "invalid") {
    console.log("\n[TEST] invalid email — missing fields");
    console.log(
      "Expected: ValidationError → status=failed, attempts=1, no retry\n",
    );

    const job = await enqueue("send_email", {
      to: "not-an-email", // invalid format
      subject: "", // missing subject
      body: "", // missing body
    });

    console.log(`Enqueued job #${job.id}`);
    console.log(
      "Expected in DB: status=failed, retry_strategy=no_retry, attempts=1",
    );
  }

  // ── concurrent ──────────────────────────────────────────────────────────
  if (test === "concurrent") {
    console.log("\n[TEST] 20 email jobs at once");
    console.log("Expected: all 5 workers pick up jobs simultaneously\n");

    const jobs = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        enqueue("send_email", {
          to: `user${i + 1}@example.com`,
          subject: `Email #${i + 1}`,
          body: `This is email number ${i + 1}`,
        }),
      ),
    );

    console.log(`Enqueued ${jobs.length} jobs`);
    console.log(`IDs: ${jobs.map((j) => j.id).join(", ")}`);
    console.log(
      "\nWatch Terminal 1 — you should see 5 workers all busy at once",
    );
    console.log("Check DB:");
    console.log("  SELECT status, COUNT(*) FROM jobs GROUP BY status;");
  }

  process.exit(0);
}

run().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
