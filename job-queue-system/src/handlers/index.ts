import { Job, JobHandler, JobType } from "../types/types";
import { emailHandler } from "./emailHandler";
import {
  sendEmailIdempotent,
  testHttpError,
  testPgError,
  testSuccess,
  testRetryShort,
  testNoRetry,
  testRetryLong,
  testEmailHandler,
  
} from "./errorTestHandler";
import { failingHandler } from "./failingHandler";

const handlers: Record<JobType, JobHandler> = {
  send_email: emailHandler,
  failing_test: failingHandler,
  process_media: async () => {
    throw new Error("Not implemented");
  },
  process_payment: async () => {
    throw new Error("Not implemented");
  },
  generate_report: async () => {
    throw new Error("Not implemented");
  },
  "test:no-retry": testNoRetry,
  "test:retry_long": testRetryLong,
  "test:retry-short": testRetryShort,
  "test-success": testSuccess,
  "test:pg-error": testPgError,
  "test:http-error": testHttpError,
  "email:send": sendEmailIdempotent,
  
  "test-email": testEmailHandler,
};

export async function executeJob(job: Job): Promise<void> {
  const handler = handlers[job.type];
  if (!handler) {
    throw new Error(`No handler found for job type: ${job.type}`);
  }
  await handler(job);
}
