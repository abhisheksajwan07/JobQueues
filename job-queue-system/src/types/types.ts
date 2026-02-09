export type JobType =
  | "send_email"
  | "process_media"
  | "process_payment"
  | "generate_report";

export type JobStatus = "pending" | "processing" | "completed" | "failed";

export interface Job {
  id: number;
  type: JobType;
  payload: any;
  status: JobStatus;
  max_attempts: number;
  attempts: number;
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

export type JobPayLoad =
  | EmailPayload
  | PaymentPayload
  | ReportPayload
  | MediaPayload;
