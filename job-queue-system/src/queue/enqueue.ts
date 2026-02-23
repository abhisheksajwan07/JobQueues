import { randomUUID } from "crypto";
import { JobType, JobPayLoad, Job } from "../types/types";
import { getPool, query } from "../db/connection";
import parseJob from "../helper/helper";

export async function enqueue(
  type: JobType,
  payload: JobPayLoad,
  idempotencyKey?: string,
): Promise<Job> {
  const key = idempotencyKey ?? randomUUID();

  const client = await getPool().connect();

  try {
    await client.query("BEGIN");

    // if conflict -> xmax !=0 means false
    const result = await client.query(
      `
    INSERT INTO jobs(type,payload,idempotency_key)
    VALUES ($1,$2,$3)
    ON CONFLICT (idempotency_key)
    DO UPDATE SET idempotency_key=jobs.idempotency_key
    RETURNING *, (xmax=0) AS is_new;
    `,
      [type, payload, key],
    );

    const row = result.rows[0];

    if (!row) {
      throw new Error("failed to insert job");
    }

    if (row.is_new) {
      await client.query('NOTIFY new_job');
    }
    await client.query("COMMIT");
    return parseJob(row);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
