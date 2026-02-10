import { randomUUID } from "crypto";

import { JobType, JobPayLoad, Job } from "../types/types";
import { query } from "../db/connection";
import parseJob from "../helper/helper";

async function enqueue(
  type: JobType,
  payload: JobPayLoad,
  idempotencyKey?: string,
): Promise<Job> {
  const key = idempotencyKey ?? randomUUID();

  const payloadJson = JSON.stringify(payload);

  // if conflict -> xmax !=0 means false
  const result = await query(
    `
    INSERT INTO jobs(type,payload,idempotency_key)
    VALUES ($1,$2,$3)
    ON CONFLICT (idempotency_key)
    DO UPDATE SET idempotency_key=jobs.idempotency_key
    RETURNING *, (xmax=0) AS is_new;
    `,
    [type, payloadJson, key],
  );

  const row = result.rows[0];

  if (!row) {
    throw new Error("failed to insert job");
  }

  const job = parseJob(row);
  // notify if requested is created the job
  // is_new = true
  if (row.is_new) {
    await query(`NOTIFY new_job'`);
  }
  return job;
}
