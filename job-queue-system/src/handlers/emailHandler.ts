import { resolve } from "node:dns";
import { EmailPayload, Job } from "../types/types";

export async function emailHandler(job: Job): Promise<void> {
  console.log(`sending email to  ${job.payload.to}`);
  console.log(`   Subject: ${job.payload.subject}`);
  console.log(`   Body: ${job.payload.body}`);

  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.log(` Email sent successfully!`);
}
