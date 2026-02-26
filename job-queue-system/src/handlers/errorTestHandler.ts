import {
  ValidationError,
  NetworkError,
  RateLimiterError,
} from "../error/errors";
import { Job } from "../types/types";

export async function testNoRetry(payload: any) {
  console.log(" Throwing permanent error...");
  throw new ValidationError("Invalid email format: not-an-email");
}

export async function testRetryShort(payload: any) {
  console.log(" Throwing temporary error...");
  throw new NetworkError("Connection timeout after 5000ms");
}

export async function testRetryLong(payload: any) {
  console.log(" Throwing transient error...");
  throw new RateLimiterError("Rate limit exceeded: 429 Too Many Requests");
}

let count = 0;
export async function testSuccess(payload: any) {
  count++;
  if (count < 3) {
    throw new NetworkError("Temporary failure");
  }
  console.log("success");
  count = 0;
}

export async function testPgError(payload: any) {
  const error: any = new Error(
    "duplicate key value violates unique constraint",
  );
  error.code = "23505";
  throw error;
}

export async function testHttpError(payload: any) {
  const error: any = new Error("too many request");
  error.response = { status: 429 };
  throw error;
}

const sentEMails = new Set<number>();

export async function sendEmailIdempotent(payload: any) {
  const { email, jobId, subject } = payload;

  if (sentEMails.has(jobId)) {
    console.log(`email already sent for job ${jobId},skipping`);
    return;
  }

  console.log(`sending email to ${email}:${subject}`);

  if (Math.random() < 0.5) {
    throw new NetworkError("SMTP timeout");
  }
  sentEMails.add(jobId);
  console.log(`email sent and recorded`);
}

const sentEmails = new Set<number>();

export async function testEmailHandler(job: Job): Promise<void> {
  const payload = job.payload as {
    email: string;
    jobId: number;
    subject: string;
  };

  const { email, jobId, subject } = payload;

  // idempotency check — already sent? skip
  if (sentEmails.has(jobId)) {
    console.log(`  [email] job ${jobId} already sent, skipping`);
    return;
  }

  console.log(`  [email] Sending email to ${email} — subject: "${subject}"`);

  // simulate 50% SMTP failure — causes retry
  if (Math.random() < 0.5) {
    console.log(`  [email] SMTP failed — will retry`);
    throw new NetworkError("SMTP timeout");
  }

  // simulate send delay
  await new Promise((r) => setTimeout(r, 300));

  sentEmails.add(jobId);
  console.log(`  [email] Email sent and recorded for jobId=${jobId}`);
}

export async function testManyHandler(job: Job): Promise<void> {
  const payload = job.payload as { i: number };
  console.log(`  [many] Job #${job.id} worker processing item ${payload.i}`);

  // simulate some work — 500ms to 1500ms random
  const delay = Math.floor(Math.random() * 1000) + 500;
  await new Promise((r) => setTimeout(r, delay));

  console.log(
    `  [many] Job #${job.id} item ${payload.i} done (took ${delay}ms)`,
  );
}
