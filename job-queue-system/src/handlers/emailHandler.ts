
import { EmailPayload, Job } from "../types/types";

export async function emailHandler(job: Job): Promise<void> {
  const payload = job.payload as EmailPayload
  console.log(`sending email to  ${payload.to}`);
   console.log(payload.to);       
  console.log(payload.subject);

  await new Promise((resolve) => setTimeout(resolve, 30000));

  console.log(` Email sent successfully!`);
}
