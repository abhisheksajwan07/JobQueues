import { Job, JobType } from "../types/types";

export default function parseJob(row: any): Job {
  return {
    id: Number(row.id),
    type: row.type as JobType,
    payload: row.payload,
    status: row.status,
    attempts: row.attempts,
    max_attempts: row.max_attempts,
    error_message: row.error_message,
    scheduled_for: row.scheduled_for,
    retry_strategy: row.retry_strategy,
    locked_until: row.locked_until,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
