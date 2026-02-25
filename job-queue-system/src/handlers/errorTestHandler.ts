import {
  ValidationError,
  NetworkError,
  RateLimiterError,
} from "../error/errors";

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
