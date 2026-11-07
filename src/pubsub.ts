import { PubSub } from 'graphql-subscriptions';
import type { TaskDocument } from './modules/task/task.model';

export const TASK_UPDATED = 'TASK_UPDATED';

export interface TaskUpdatedEvent {
  projectId: string;
  task: TaskDocument;
}

type Events = {
  TASK_UPDATED: TaskUpdatedEvent;
};

export const pubsub = new PubSub<Events>();
