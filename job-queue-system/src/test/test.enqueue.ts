import { enqueue } from "../queue/enqueue";

async function test() {
  console.log('🧪 Test: Enqueue a job');
  
  try {
    const job = await enqueue('send_email', {
      to: 'test@example.com',
      subject: 'Test Email',
      body: 'This is a test'
    });
    
    console.log('Job enqueued successfully!');
    console.log('Job ID:', job.id);
    console.log('Job type:', job.type);
    console.log('Job status:', job.status);
    
    process.exit(0);
  } catch (error) {
    
    console.error(' Test failed:', error);
    process.exit(1);
  }
}

test();