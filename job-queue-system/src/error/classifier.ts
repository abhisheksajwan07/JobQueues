import { classifyError } from "./retry-classifier";
import { ValidationError, NetworkError, RateLimiterError } from "./errors";

console.log("ValidationError:", classifyError(new ValidationError("test")));
console.log("network error", classifyError(new NetworkError("test")));
console.log("RateLimitError:", classifyError(new RateLimiterError("test")));

const pgError: any = { code: "23505" };
console.log("PG unique violation:", classifyError(pgError));

const httpError: any = { response: { status: 429 } };
console.log("HTTP 429:", classifyError(httpError));
