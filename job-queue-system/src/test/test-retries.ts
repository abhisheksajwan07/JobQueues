import { enqueue } from "../queue/enqueue";

async function runTests() {
  console.log(" TESTING RETRY SYSTEM\n");

  console.log("1 Testing no_retry (permanent error)");
  await enqueue("test:no-retry", {});

  console.log("\n 2️ Testing retry_short (temporary error)");
  await enqueue("test:retry-short", {});

  console.log("\n 3️ Testing retry_long (transient error)");
  await enqueue("test:retry_long", {});

  console.log("\n 4️ Testing success");
  await enqueue("test-success", {});

  console.log("\n 5️ Testing PostgreSQL error");
  await enqueue("test:pg-error", {});

  console.log("\n 6️ Testing HTTP 429 error");
  await enqueue("test:http-error", {});

  console.log("\n 7️ Testing idempotent email (will retry with 50% failure)");
  await enqueue("email:send", {
    to: "user@example.com",
    subject: "Test Email",
  });

  console.log("\n All test  enqueued\n");
  process.exit(0);
}

runTests();
