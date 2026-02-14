export type JobType =
  | "send_email"
  | "process_media"
  | "process_payment"
  | "generate_report"
  | "failing_test";

export type JobStatus = "pending" | "processing" | "completed" | "failed";

export interface Job {
  id: number;
  type: JobType;
  payload: JobPayLoad;
  status: JobStatus;

  max_attempts: number;
  attempts: number;
  locked_until?: Date;
  error_message: string | null;
  scheduled_for: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface EmailPayload {
  to: string;
  from?: string;
  subject: string;
  body: string;
  cc?: string[];
}

export interface PaymentPayload {
  amount: number;
  currency: string;
  customerId: string;
  paymentMethodId: string;
}
export interface ReportPayload {
  reportType: string;
  userId: string;
  startDate: string;
  endDate: string;
}
export interface MediaPayload {
  sourceUrl: string;
  format: string[];
  destinationPath: string;
}

export interface TestPayload {
  [key: string]: any;
}

export type JobPayLoad =
  | EmailPayload
  | PaymentPayload
  | ReportPayload
  | MediaPayload
  | TestPayload;

export type JobHandler = (job: Job) => Promise<void>;
