import { requireUser } from '../../auth/guards';
import type { Resolvers } from '../../graphql/generated/graphql';
import { requireLoadedProject, requireLoadedUser } from '../../graphql/load';
import { pubsub, TASK_UPDATED, type TaskUpdatedEvent } from '../../pubsub';
import { projectService } from '../project/project.service';
import { parseInput } from '../../validation/parse';
import {
  createTaskSchema,
  objectIdSchema,
  taskFilterSchema,
  updateTaskSchema,
} from '../../validation/schemas';
import { taskService } from './task.service';

async function* filterTaskUpdates(
  projectId: string,
): AsyncGenerator<{ taskUpdated: TaskUpdatedEvent['task'] }> {
  const iterator = pubsub.asyncIterableIterator<TaskUpdatedEvent>(TASK_UPDATED);
  try {
    for (;;) {
      const next = await iterator.next();
      if (next.done) break;
      if (next.value.projectId === projectId) {
        yield { taskUpdated: next.value.task };
      }
    }
  } finally {
    if (typeof iterator.return === 'function') {
      await iterator.return();
    }
  }
}

export const taskResolvers: Resolvers = {
  Query: {
    task: async (_parent, args, context) => {
      const actor = requireUser(context, 'VIEWER');
      const id = parseInput(objectIdSchema, args.id);
      return taskService.getForActor(actor, id);
    },
    tasks: (_parent, args, context) => {
      const actor = requireUser(context, 'VIEWER');
      const projectId =
        args.projectId == null ? undefined : parseInput(objectIdSchema, args.projectId);
      const filter = args.filter ? parseInput(taskFilterSchema, args.filter) : undefined;
      return taskService.list(actor, {
        projectId,
        first: args.first,
        after: args.after,
        filter,
      });
    },
  },
  Mutation: {
    createTask: async (_parent, args, context) => {
      const actor = requireUser(context, 'MEMBER');
      const input = parseInput(createTaskSchema, args.input);
      return taskService.create(actor, input);
    },
    updateTask: async (_parent, args, context) => {
      const actor = requireUser(context, 'MEMBER');
      const id = parseInput(objectIdSchema, args.id);
      const input = parseInput(updateTaskSchema, args.input);
      return taskService.update(actor, id, input);
    },
    deleteTask: async (_parent, args, context) => {
      const actor = requireUser(context, 'MEMBER');
      const id = parseInput(objectIdSchema, args.id);
      return taskService.remove(actor, id);
    },
  },
  Subscription: {
    taskUpdated: {
      subscribe: async (_parent, args, context) => {
        const actor = requireUser(context, 'VIEWER');
        await projectService.getForActor(actor, args.projectId, 'VIEWER');
        return filterTaskUpdates(args.projectId);
      },
    },
  },
  Task: {
    project: (task, _args, context) => requireLoadedProject(context, task.project),
    assignee: async (task, _args, context) => {
      if (!task.assignee) return null;
      return context.loaders.userById.load(task.assignee.toString());
    },
    reporter: (task, _args, context) => requireLoadedUser(context, task.reporter),
  },
};
