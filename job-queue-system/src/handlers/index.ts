import { Job, JobHandler, JobType } from "../types/types";
import { emailHandler } from "./emailHandler";

const handlers: Record<JobType, JobHandler> = {
  send_email: emailHandler,
  process_media: async () => {
    throw new Error("Not implemented");
  },
  process_payment: async () => {
    throw new Error("Not implemented");
  },
  generate_report: async () => {
    throw new Error("Not implemented");
  },
};

export async function executeJob(job: Job): Promise<void> {
  const handler = handlers[job.type];
  if (!handler) {
    throw new Error(`No handler found for job type: ${job.type}`);
  }
  await handler(job);
}
