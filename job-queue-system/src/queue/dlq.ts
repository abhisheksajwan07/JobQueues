import { PoolClient } from "pg";
import { Job } from "../types/types";
import { RetryStrategy } from "../error/retry-classifier";
import { getPool } from "../db/connection";

export async function moveToDlq(
  client: PoolClient,
  job: Job,
  reason: string,
  strategy: RetryStrategy,
): Promise<void> {
  await client.query(
    `INSERT INTO dead_letter_jobs 
         (original_job_id,type,payload,error_message,retry_strategy,attempts)
         VALUES ($1,$2,$3,$4,$5,$6)`,
    [job.id, job.type, job.payload, reason, strategy, job.attempts],
  );
  await client.query(`DELETE FROM jobs WHERE id=$1`, [job.id]);
  console.log(`Job #${job.id} moved to DLQ}`);
}

export async function requeue(dlqJobId: number): Promise<number> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT id,type,payload,status FROM dead_letter_jobs WHERE id=$1
      `,
      [dlqJobId],
    );
    const dlqJob = result.rows[0];
    if (!dlqJob) {
      throw new Error(`DLQ job #${dlqJobId} not found`);
    }
    if (dlqJob.status === "resolved") {
      throw new Error(`DLQ jobs #${dlqJobId} already requeued`);
    }
    const newJob = await client.query(
      `INSERT INTO jobs (type,payload,status,attempts,scheduled_for)
      VALUES ($1,$2,'pending',0,NOW())
      RETURNING id`,
      [dlqJob.type, dlqJob.payload],
    );
    const newJobId: number = Number(newJob.rows[0].id);

    await client.query(
      `UPDATE dead_letter_jobs
      SET status='resolved',
          requeued_at=NOW(),
          requeued_job_id=$1
      WHERE id=$2`,
      [newJobId, dlqJobId],
    );
    await client.query("COMMIT");
    console.log(`DLQ job #${dlqJobId} requeued as new job #${newJobId}`);
    return newJobId;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function ListDLQ(): Promise<void> {
  const pool = getPool();

  const result = await pool.query(
    `SELECT id,original_job_id,type,attempts,status,retry_strategy,error_message,failed_at
     FROM dead_letter_jobs 
     ORDER BY failed_at DESC`,
  );
  if (result.rows.length === 0) {
    console.log("DLQ is empty ");
    return;
  }
  result.rows.forEach((job) => {
    console.log(
      `DLQ #${job.id} | original=${job.original_job_id} | type=${job.type} | status=${job.status} | error=${job.error_message}`,
    );
  });
}
