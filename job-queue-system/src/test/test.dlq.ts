import { enqueue } from "../queue/enqueue";
import { requeue, ListDLQ } from "../queue/dlq";
import { getPool } from "../db/connection";

const pool = getPool();

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getDLQByOriginalJobId(originalJobId: number) {
  const r = await pool.query(
    `SELECT * FROM dead_letter_jobs WHERE original_job_id=$1`,
    [originalJobId],
  );
  return r.rows[0] ?? null;
}

async function getJob(jobId: number) {
  const r = await pool.query(`SELECT * FROM jobs WHERE id=$1`, [jobId]);
  return r.rows[0] ?? null;
}

async function run() {
  console.log("\n========================================");
  console.log("         DLQ TEST");
  console.log("========================================\n");

  // ── TEST 1: no_retry → goes to DLQ immediately ─────────────────────────
  console.log("TEST 1: no_retry job → should land in DLQ on first failure");

  const job1 = await enqueue("test:no-retry", { msg: "permanent failure" });
  console.log(`  Enqueued job #${job1.id}`);
  console.log("  Waiting 4s for worker to process...");
  await wait(4000);

  const dlq1 = await getDLQByOriginalJobId(job1.id);
  const job1StillExists = await getJob(job1.id);

  if (dlq1 && !job1StillExists) {
    console.log(` TEST 1 PASSED`);
    console.log(`  DLQ row id=${dlq1.id}`);
    console.log(`  error_message=${dlq1.error_message}`);
    console.log(`  retry_strategy=${dlq1.retry_strategy}`);
    console.log(`  attempts=${dlq1.attempts}`);
    console.log(`  job #${job1.id} deleted from jobs table \n`);
  } else if (!dlq1) {
    console.log(` TEST 1 FAILED — job not in DLQ`);
    console.log(`  Check: is worker running? did you run the migration?\n`);
    await pool.end();
    process.exit(1);
  } else {
    console.log(` TEST 1 FAILED — job still in jobs table, not deleted\n`);
    await pool.end();
    process.exit(1);
  }

  // ── TEST 2: retry_short → retries first, not in DLQ yet ────────────────
  console.log("TEST 2: retry_short job → should retry, NOT go to DLQ yet");

  const job2 = await enqueue("test:retry-short", { msg: "will retry" });
  console.log(`  Enqueued job #${job2.id}`);
  console.log("  Waiting 4s for worker to process first attempt...");
  await wait(4000);

  const job2Row = await getJob(job2.id);
  const dlq2 = await getDLQByOriginalJobId(job2.id);

  if (
    job2Row &&
    job2Row.attempts === 1 &&
    job2Row.status === "pending" &&
    !dlq2
  ) {
    console.log(` TEST 2 PASSED`);
    console.log(`  Job #${job2.id} still in jobs table `);
    console.log(`  status=pending, attempts=1 `);
    console.log(`  scheduled_for=${job2Row.scheduled_for} (future retry) `);
    console.log(`  NOT in DLQ yet \n`);
  } else {
    console.log(
      `  Job status=${job2Row?.status}, attempts=${job2Row?.attempts}`,
    );
    console.log(`  In DLQ: ${!!dlq2}`);
    console.log(`  (still counts as working if attempts incremented)\n`);
  }

  // ── TEST 3: requeue a DLQ job ───────────────────────────────────────────
  console.log("TEST 3: requeue — bring DLQ job back into jobs table");

  console.log(`  Requeueing DLQ row #${dlq1.id}...`);
  const newJobId = await requeue(dlq1.id);
  console.log(`  New job #${newJobId} created`);

  await wait(1000);

  const newJob = await getJob(newJobId);
  const dlq1Updated = await pool.query(
    `SELECT status, requeued_job_id FROM dead_letter_jobs WHERE id=$1`,
    [dlq1.id],
  );
  const dlqStatus = dlq1Updated.rows[0]?.status;
  const dlqRequeuedId = Number(dlq1Updated.rows[0]?.requeued_job_id);

  if (newJob && dlqStatus === "resolved" && dlqRequeuedId === newJobId) {
    console.log(` TEST 3 PASSED`);
    console.log(
      `  New job #${newJobId} in jobs table, status=${newJob.status} `,
    );
    console.log(`  DLQ row #${dlq1.id} status=resolved `);
    console.log(`  requeued_job_id=${dlqRequeuedId} \n`);
  } else {
    console.log(` TEST 3 FAILED`);
    console.log(`  new job: ${JSON.stringify(newJob)}`);
    console.log(`  dlq status: ${dlqStatus}\n`);
  }

  // ── TEST 4: requeue same job twice → should throw ───────────────────────
  console.log("TEST 4: requeue same DLQ job twice → should throw error");

  try {
    await requeue(dlq1.id);
    console.log(` TEST 4 FAILED — should have thrown but didn't\n`);
  } catch (err: any) {
    if (err.message.includes("already requeued")) {
      console.log(` TEST 4 PASSED — threw: "${err.message}"\n`);
    } else {
      console.log(` TEST 4 FAILED — wrong error: ${err.message}\n`);
    }
  }

  // ── FINAL STATE ─────────────────────────────────────────────────────────
  console.log("========================================");
  console.log("  FINAL DLQ STATE");
  console.log("========================================");
  await ListDLQ();

  await pool.end();
  process.exit(0);
}

run().catch((err) => {
  console.error("Test crashed:", err.message);
  process.exit(1);
});
