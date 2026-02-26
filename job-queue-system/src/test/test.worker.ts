

import { enqueue } from "../queue/enqueue";

const test = process.argv[2];

if (!test) {
  console.log(`
Usage: npx ts-node src/test/test.worker.ts <testname>

Tests:
  basic               1 job, completes successfully
  concurrent          5 jobs at once
  idempotency         same job twice, only 1 runs
  no-retry            ValidationError → fails immediately
  retry-short         NetworkError → retries 3x then fails
  retry-long          RateLimiterError → retries 5x with long delay
  pg-error            Postgres error code → no retry
  http-error          HTTP 429 → retry_long strategy
  success-after-retry fails 2x then succeeds on 3rd
  many                20 jobs → all 5 workers busy
  email               idempotent email with random failures
  `);
  process.exit(0);
}

async function run() {
  // ─── BASIC ───────────────────────────────────────────────────────────────
  if (test === "basic") {
    console.log("\n[TEST] basic — enqueue 1 success job");
    console.log("Expected: worker picks it up, logs success, status=completed");
    console.log("─────────────────────────────────────────");

    const job = await enqueue("test-success", { msg: "hello world" });
    console.log(`Enqueued job #${job.id} (type: test-success)`);
    console.log("Now watch your worker logs...");
    console.log(`Check DB: SELECT id, status, attempts FROM jobs WHERE id=${job.id};`);
  }


  if (test === "concurrent") {
    console.log("\n[TEST] concurrent — enqueue 5 jobs simultaneously");
    console.log("Expected: all 5 workers pick 1 job each, all complete");
    console.log("─────────────────────────────────────────");

    const jobs = await Promise.all([
      enqueue("test-success", { i: 1 }),
      enqueue("test-success", { i: 2 }),
      enqueue("test-success", { i: 3 }),
      enqueue("test-success", { i: 4 }),
      enqueue("test-success", { i: 5 }),
    ]);

    console.log("Enqueued 5 jobs:");
    jobs.forEach((j) => console.log(`  Job #${j.id}`));
    console.log("Check DB: SELECT id, status FROM jobs ORDER BY id DESC LIMIT 5;");
  }

  
  if (test === "idempotency") {
    const key = "idempotency-test-key-999";
    console.log("\n[TEST] idempotency — same key enqueued twice");
    console.log("Expected: only 1 job in DB, only 1 processed");
    console.log("─────────────────────────────────────────");

    const job1 = await enqueue("test-success", { msg: "first" }, key);
    console.log(`First enqueue → job #${job1.id}`);

    const job2 = await enqueue("test-success", { msg: "duplicate" }, key);
    console.log(`Second enqueue → job #${job2.id}`);

    if (job1.id === job2.id) {
      console.log("✓ Same job returned — idempotency working correctly");
    } else {
      console.log("✗ Different jobs returned — idempotency BROKEN");
    }

    console.log(`Check DB: SELECT id, status FROM jobs WHERE idempotency_key='${key}';`);
  }

  // ─── NO RETRY ────────────────────────────────────────────────────────────
  if (test === "no-retry") {
    console.log("\n[TEST] no-retry — ValidationError thrown");
    console.log("Expected: job fails immediately, status=failed, attempts=1, NO retry");
    console.log("─────────────────────────────────────────");

    const job = await enqueue("test:no-retry", { msg: "will fail instantly" });
    console.log(`Enqueued job #${job.id} (type: test:no-retry)`);
    console.log("Watch worker logs — should see: permanently failed");
    console.log(`Check DB: SELECT id, status, attempts, error_message, retry_strategy FROM jobs WHERE id=${job.id};`);
    console.log("Expected: status=failed, attempts=1, retry_strategy=no_retry");
  }

  // ─── RETRY SHORT ─────────────────────────────────────────────────────────
  if (test === "retry-short") {
    console.log("\n[TEST] retry-short — NetworkError thrown");
    console.log("Expected: retries 3 times with exponential backoff (60s, 120s, 240s)");
    console.log("─────────────────────────────────────────");

    const job = await enqueue("test:retry-short", { msg: "will retry 3 times" });
    console.log(`Enqueued job #${job.id} (type: test:retry-short)`);
    console.log("Watch worker logs — should see: retry scheduled x3 then permanently failed");
    console.log(`Check DB: SELECT id, status, attempts, scheduled_for, error_message FROM jobs WHERE id=${job.id};`);
    console.log("Expected: attempts goes 1→2→3, then status=failed");
  }

  // ─── RETRY LONG ──────────────────────────────────────────────────────────
  if (test === "retry-long") {
    console.log("\n[TEST] retry-long — RateLimiterError thrown");
    console.log("Expected: retries 5 times with long backoff (1800s, 3600s...)");
    console.log("─────────────────────────────────────────");

    const job = await enqueue("test:retry_long", { msg: "rate limited" });
    console.log(`Enqueued job #${job.id} (type: test:retry_long)`);
    console.log("Watch worker logs — first attempt will fail, then scheduled far in future");
    console.log(`Check DB: SELECT id, status, attempts, scheduled_for, retry_strategy FROM jobs WHERE id=${job.id};`);
    console.log("Expected: retry_strategy=retry_long, scheduled_for = 30min from now");
  }

  // ─── PG ERROR ────────────────────────────────────────────────────────────
  if (test === "pg-error") {
    console.log("\n[TEST] pg-error — Postgres error code 23505 (unique violation)");
    console.log("Expected: classifies as no_retry, fails immediately");
    console.log("─────────────────────────────────────────");

    const job = await enqueue("test:pg-error", { msg: "pg unique violation" });
    console.log(`Enqueued job #${job.id} (type: test:pg-error)`);
    console.log(`Check DB: SELECT id, status, attempts, retry_strategy FROM jobs WHERE id=${job.id};`);
    console.log("Expected: status=failed, retry_strategy=no_retry, attempts=1");
  }

  // ─── HTTP ERROR ──────────────────────────────────────────────────────────
  if (test === "http-error") {
    console.log("\n[TEST] http-error — HTTP 429 response");
    console.log("Expected: classifies as retry_long, retries 5 times");
    console.log("─────────────────────────────────────────");

    const job = await enqueue("test:http-error", { msg: "too many requests" });
    console.log(`Enqueued job #${job.id} (type: test:http-error)`);
    console.log(`Check DB: SELECT id, status, attempts, retry_strategy, scheduled_for FROM jobs WHERE id=${job.id};`);
    console.log("Expected: retry_strategy=retry_long");
  }

  // ─── SUCCESS AFTER RETRY ─────────────────────────────────────────────────
  if (test === "success-after-retry") {
    console.log("\n[TEST] success-after-retry — fails 2x then succeeds on 3rd");
    console.log("Expected: attempts=1 fail, attempts=2 fail, attempts=3 success, status=completed");
    console.log("─────────────────────────────────────────");
    console.log("NOTE: testSuccess handler has a module-level counter");
    console.log("      it throws NetworkError for first 2 calls, succeeds on 3rd");

    const job = await enqueue("test-success", { msg: "eventually works" });
    console.log(`Enqueued job #${job.id} (type: test-success)`);
    console.log(`Check DB: SELECT id, status, attempts FROM jobs WHERE id=${job.id};`);
    console.log("Expected: status=completed after 3 attempts");
  }

  // ─── MANY ────────────────────────────────────────────────────────────────
  if (test === "test-many") {
    console.log("\n[TEST] many — 20 jobs enqueued at once");
    console.log("Expected: all 5 workers pick up jobs, process in parallel, all complete");
    console.log("─────────────────────────────────────────");

    const promises = [];
    for (let i = 1; i <= 20; i++) {
      promises.push(enqueue("test-success", { i }));
    }

    const jobs = await Promise.all(promises);
    console.log(`Enqueued ${jobs.length} jobs`);
    console.log(`IDs: ${jobs.map((j) => j.id).join(", ")}`);
    console.log("Watch worker — all 5 loops should be busy");
    console.log("Check DB: SELECT status, COUNT(*) FROM jobs GROUP BY status;");
  }

  // ─── EMAIL ───────────────────────────────────────────────────────────────
  if (test === "test-email") {
    console.log("\n[TEST] email — idempotent email send with random SMTP failures");
    console.log("Expected: retries on NetworkError, skips if already sent");
    console.log("─────────────────────────────────────────");

    const job = await enqueue("email:send", {
      email: "test@example.com",
      jobId: 9999,
      subject: "Hello from queue",
    });
    console.log(`Enqueued job #${job.id} (type: email:send)`);
    console.log("Watch worker — may retry if SMTP fails (50% chance)");
    console.log(`Check DB: SELECT id, status, attempts FROM jobs WHERE id=${job.id};`);
  }

  process.exit(0);
}

run().catch((err) => {
  console.error("Test script error:", err);
  process.exit(1);
});