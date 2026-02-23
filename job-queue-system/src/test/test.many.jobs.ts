import { enqueue } from "../queue/enqueue";

async function test() {
  console.log("enqueueing 50 jobs");

  for (let i = 1; i <= 50; i++) {
    await enqueue("send_email", {
      to: `user${i}example.com`,
      subject: `Email ${i}`,
      body: `test email ${i}`,
    });
  }
  console.log("50 jobs enqueued");
  process.exit(0);
}
test();
