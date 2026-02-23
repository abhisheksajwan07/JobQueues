import { Job } from '../types/types';

export async function failingHandler(job: Job): Promise<void> {
  console.log('FAILING HANDLER - This will always fail!');
  throw new Error('Simulated failure for testing');
}