import { enqueue } from "../queue/enqueue";

async function test() {
  console.log('🧪 Test: Failing jobs');
  
  try {
    const job = await enqueue("failing_test", {
     
    });
    
    console.log(' Failing job enqueued successfully!');
    console.log('   Job ID:', job.id);
    console.log('   Job type:', job.type);
    console.log('   Job status:', job.status);
    
    process.exit(0);  
  } catch (error) {
    console.error(' Test failed:', error);
    process.exit(1);  
  }
}


test();