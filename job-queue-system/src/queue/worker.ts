import { Pool, PoolClient } from "pg";
import { getPool } from "../db/connection";
import { executeJob } from "../handlers";
import parseJob from "../helper/helper";
import {
  classifyError,
  getMaxAttempts,
  getRetryDelay,
  RetryStrategy,
} from "../error/retry-classifier";
import { Job } from "../types/types";

export class Worker {
  private pool: Pool;

  private isRunning: boolean = false;
  private concurrency: number;
  private wakeResolvers: (() => void)[] = [];
  private loops: Promise<void>[] = [];

  private sleep(s: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, s));
  }

  constructor(concurrency = 5) {
    this.pool = getPool();
    this.concurrency = concurrency;
  }

  async start(): Promise<void> {
    console.log(`Worker started with concurrency=${this.concurrency}`);

    await this.cleanStuckJobs();
    this.isRunning = true;

    await this.setupListener();

    this.loops = [];
    for (let i = 0; i < this.concurrency; i++) {
      this.loops.push(this.workerLoop(i));
    }
    await Promise.all(this.loops);
  }

  async stop(): Promise<void> {
    console.log("Stopping worker...");
    this.isRunning = false;
    this.wakeResolvers.forEach((r) => r());
    await Promise.all(this.loops);
    await this.pool.end();
  }

  private async setupListener(): Promise<void> {
    const client = await this.pool.connect();
    await client.query("LISTEN new_job");
    console.log("listening for new_job notification");

    client.on("notification", () => {
      this.wakeOneWorker();
    });

    client.on("error", (err) => {
      console.error("Listener client error:", err);
      client.release();
      setTimeout(() => {
        this.setupListener();
      }, 5000);
    });
  }

  private wakeOneWorker() {
    const resolver = this.wakeResolvers.shift();
    if (resolver) resolver();
  }

  private waitForSignal(): Promise<void> {
    return new Promise((resolve) => {
      this.wakeResolvers.push(resolve);
      setTimeout(resolve, 30000);
    });
  }

  private async workerLoop(workerId: number): Promise<void> {
    console.log(`Worker #${workerId} ready`);
    while (this.isRunning) {
      
      const job = await this.claimJob();

      if (!job) {
        await this.waitForSignal();
        continue;
      }
      console.log(`Worker #${workerId} picked Job #${job.id}`);
      try {
        await executeJob(parseJob(job));
        await this.completeJob(job.id);
      } catch (err) {
        console.error(`Job ${job.id} failed`, err);
        await this.failJob(job.id, err as Error);
      }
    }
    console.log(`Worker #${workerId} stopped`);
  }

  private async claimJob(): Promise<Job | null> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(`
      SELECT * FROM jobs
      WHERE status = 'pending'
      AND scheduled_for <= NOW()
      AND (locked_until IS NULL OR locked_until <= NOW())
      ORDER BY scheduled_for ASC, created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `);

      const job = result.rows[0] ?? null;

      if (!job) {
        await client.query("COMMIT");
        return null;
      }

      await client.query(
        `UPDATE jobs
       SET status = 'processing',
           locked_until = NOW() + INTERVAL '5 min',
           updated_at = NOW()
       WHERE id = $1`,
        [job.id],
      );

      await client.query("COMMIT");
      return job;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err; // never swallow errors
    } finally {
      client.release();
    }
  }

  private async completeJob(jobId: number): Promise<void> {
    await this.pool.query(
      `
        UPDATE jobs
        SET status='completed',
            locked_until = NULL,
            updated_at=NOW()
        WHERE id=$1
      `,
      [jobId],
    );
    console.log(` Job #${jobId} completed`);
  }

  private async failJob(jobId: number, error: Error): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(
        `
        UPDATE jobs 
        SET attempts = attempts+1
        WHERE id=$1
        RETURNING attempts`,
        [jobId],
      );
      const newAttempts: number = result.rows[0].attempts;

      const strategy: RetryStrategy = classifyError(error);
      const maxAttempts = getMaxAttempts(strategy);

      this.logFailure(jobId, error, strategy, newAttempts, maxAttempts);
      await this.updateRetryStrategy(client, jobId, strategy);

      const shouldFailPermanently =
        strategy === "no_retry" || newAttempts >= maxAttempts;

      if (shouldFailPermanently) {
        const reason =
          strategy === "no_retry"
            ? error.message
            : `max attempts reached: ${error.message}`;

        await client.query(
          `UPDATE jobs
          SET status='failed',
              error_message=$1,
              retry_strategy=$2,
              locked_until=NULL,
              updated_at=NOW()
          WHERE id=$3`,
          [reason,strategy,jobId]
        )
        await client.query("COMMIT");
        console.log(`Job #${jobId} permanently failed — ${reason}`);
        return;
      }

      await this.scheduleRetry(
        client,
        jobId,
        error,
        strategy,
        newAttempts,
        maxAttempts,
      );
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  private async updateRetryStrategy(
    client: PoolClient,
    jobId: number,
    strategy: RetryStrategy,
  ): Promise<void> {
    await client.query(`UPDATE jobs SET retry_strategy = $1 WHERE id=$2`, [
      strategy,
      jobId,
    ]);
  }

  private async scheduleRetry(
    client: PoolClient,
    jobId: number,
    error: Error,
    strategy: RetryStrategy,
    newAttempts: number,
    maxAttempts: number,
  ): Promise<void> {
    const delaySeconds = getRetryDelay(strategy, newAttempts);
    await client.query(
      `UPDATE jobs
      SET status='pending',
          attempts=$1,
          error_message=$2,
          scheduled_for=NOW() + make_interval(secs=>$3),
          locked_until=NULL,
          updated_at=NOW()
      WHERE id=$4
      `,
      [newAttempts, error.message, delaySeconds, jobId],
    );
    console.log(
      `Job #${jobId} retry scheduled (attempt ${newAttempts}/${maxAttempts})`,
    );
  }

  private async cleanStuckJobs(): Promise<void> {
    const result = await this.pool.query(
      ` UPDATE jobs
        SET status='pending',
            locked_until=NULL
        WHERE status='processing'
        AND locked_until<=NOW()
        RETURNING id`,
    );
    if (result.rows.length > 0) {
      console.log(`Recovered ${result.rows.length} stuck jobs`);
    }
  }

  private logFailure(
    jobId: number,
    error: Error,
    strategy: RetryStrategy,
    newAttempts: number,
    maxAttempts: number,
  ): void {
    console.log(`Job #${jobId} failed`);
    console.log(`  Error: ${error.message}`);
    console.log(`  Strategy: ${strategy}`);
    console.log(`  Attempts: ${newAttempts}/${maxAttempts}`);
  }
}

if (require.main === module) {
  const worker = new Worker();
  worker.start().catch((err) => {
    console.log("fatal error:", err);
    process.exit(1);
  });
}
