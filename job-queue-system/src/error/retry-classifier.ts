import { RateLimiterError, NetworkError, ValidationError } from "./errors";

export type RetryStrategy = "no_retry" | "retry_short" | "retry_long";

export function classifyError(error: any): RetryStrategy {
  
  if (error instanceof ValidationError) return "no_retry";
  if (error instanceof NetworkError) return "retry_short";
  if (error instanceof RateLimiterError) return "retry_long";

  if (error.code === "23505") return "no_retry"; // unique violation
  if (error.code === "23503") return "no_retry"; // foreign key violation
  if (error.code === "23502") return "no_retry"; // not null violation
  if (error.code === "40P01") return "retry_short"; // deadlock

  if (error.code === "ECONNRESET") return "retry_short";
  if (error.code === "ETIMEDOUT") return "retry_short";
  if (error.code === "ENOTFOUND") return "retry_short";
  if (error.code === "ECONNREFUSED") return "retry_short";

  if (error.response?.status === 429) return "retry_long";
  if (error.response?.status >= 500) "retry_short";
  if (error.response?.status >= 400) return "no_retry";

  return "no_retry";
}

export function getRetryDelay(
  strategy: RetryStrategy,
  attempt: number,
): number {
  if (strategy === "no_retry") return 0;

  if (strategy === "retry_long") {
    return Math.pow(2, attempt) * 1800;
  }
  if (strategy === "retry_short") {
    return Math.pow(2, attempt) * 60;
  }
  return 0;
}

export function getMaxAttempts(strategy: RetryStrategy): number {
  if (strategy === "no_retry") return 0;
  if (strategy === "retry_short") return 3;
  if (strategy === "retry_long") return 5;
  return 0;
}
