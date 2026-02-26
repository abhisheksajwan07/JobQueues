// src/handlers/emailHandler.ts
import { EmailPayload, Job } from "../types/types";
import { NetworkError, ValidationError } from "../error/errors";

export async function emailHandler(job: Job): Promise<void> {
  const payload = job.payload as EmailPayload;

  // ── 1. Validate ───────────────────────────────────────────────────────
  if (!payload.to) {
    throw new ValidationError("Missing recipient email — no retry");
  }
  if (!payload.subject) {
    throw new ValidationError("Missing subject — no retry");
  }
  if (!payload.body) {
    throw new ValidationError("Missing body — no retry");
  }
  if (!payload.to.includes("@")) {
    throw new ValidationError(`Invalid email format: ${payload.to} — no retry`);
  }

  console.log(`[email] Job #${job.id} — sending to ${payload.to}`);
  console.log(`[email] Subject: ${payload.subject}`);

  // ── 2. Simulate SMTP network call ─────────────────────────────────────
  // 20% chance of network failure → retries with retry_short strategy
  if (Math.random() < 0.2) {
    throw new NetworkError(`SMTP timeout for ${payload.to} — will retry`);
  }

  // simulate real sending delay (1s)
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // ── 3. Done ───────────────────────────────────────────────────────────
  console.log(`[email] Job #${job.id} — email sent to ${payload.to} ✓`);
}
