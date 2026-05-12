import { Queue, Worker, type Processor, type JobsOptions } from "bullmq";
import { createRedisConnection } from "./redis.js";

export function createQueue<TData>(name: string) {
  const connection = createRedisConnection();
  const queue = new Queue<TData>(name, { connection });

  async function enqueue(data: TData, opts?: JobsOptions) {
    // BullMQ v5: ExtractNameType/ExtractDataType can't narrow unconstrained generic TData
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (queue as any).add(name, data, { attempts: 3, backoff: { type: "exponential", delay: 1000 }, ...opts });
  }

  function createWorker(processor: Processor<TData>) {
    return new Worker<TData>(name, processor, { connection: createRedisConnection() });
  }

  return { queue, enqueue, createWorker };
}
