import type { QueryFilter } from 'mongoose';
import type { AuthUser } from '../../context';
import type { TaskPriority, TaskStatus } from '../../domain/enums';
import { AppError } from '../../errors/appError';
import { paginate, type PageArgs } from '../../graphql/pagination';
import { projectService } from '../project/project.service';
import { ProjectModel, type ProjectDocument } from '../project/project.model';
import { pubsub, TASK_UPDATED } from '../../pubsub';
import { escapeRegex } from '../../utils/regex';
import { isObjectId } from '../../utils/objectId';
import { TaskModel, type TaskDocument } from './task.model';

export interface CreateTaskInput {
  projectId: string;
  title: string;
  description?: string | null;
  status?: TaskStatus | null;
  priority?: TaskPriority | null;
  assigneeId?: string | null;
  dueDate?: Date | null;
  labels?: string[] | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string | null;
  dueDate?: Date | null;
  labels?: string[];
}

export interface TaskFilter {
  status?: TaskStatus | null;
  priority?: TaskPriority | null;
  assigneeId?: string | null;
  search?: string | null;
}

async function publish(task: TaskDocument): Promise<void> {
  await pubsub.publish(TASK_UPDATED, {
    projectId: task.project.toString(),
    task,
  });
}

function assertAssignee(project: ProjectDocument, userId: string): void {
  if (!isObjectId(userId)) throw new AppError('Assignee not found', 'NOT_FOUND');
  const isMember =
    project.owner.toString() === userId ||
    project.members.some((member) => member.user.toString() === userId);
  if (!isMember) throw new AppError('Assignee must be a member of the project', 'BAD_USER_INPUT');
}

export const taskService = {
  async create(actor: AuthUser, input: CreateTaskInput): Promise<TaskDocument> {
    const project = await projectService.getForActor(actor, input.projectId, 'MEMBER');
    if (input.assigneeId) assertAssignee(project, input.assigneeId);
    const task = await TaskModel.create({
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? 'TODO',
      priority: input.priority ?? 'MEDIUM',
      project: project._id,
      assignee: input.assigneeId ?? null,
      reporter: actor.id,
      dueDate: input.dueDate ?? null,
      labels: input.labels ?? [],
    });
    await publish(task);
    return task;
  },

  async update(actor: AuthUser, id: string, input: UpdateTaskInput): Promise<TaskDocument> {
    if (!isObjectId(id)) throw new AppError('Task not found', 'NOT_FOUND');
    const task = await TaskModel.findById(id);
    if (!task) throw new AppError('Task not found', 'NOT_FOUND');
    const project = await projectService.getForActor(actor, task.project.toString(), 'MEMBER');

    if (input.title !== undefined) task.title = input.title;
    if (input.description !== undefined) task.description = input.description;
    if (input.status !== undefined) task.status = input.status;
    if (input.priority !== undefined) task.priority = input.priority;
    if (input.dueDate !== undefined) task.dueDate = input.dueDate;
    if (input.labels !== undefined) task.labels = input.labels;
    if (input.assigneeId !== undefined) {
      if (input.assigneeId) assertAssignee(project, input.assigneeId);
      task.set('assignee', input.assigneeId);
    }

    await task.save();
    await publish(task);
    return task;
  },

  async remove(actor: AuthUser, id: string): Promise<boolean> {
    if (!isObjectId(id)) throw new AppError('Task not found', 'NOT_FOUND');
    const task = await TaskModel.findById(id);
    if (!task) throw new AppError('Task not found', 'NOT_FOUND');
    await projectService.getForActor(actor, task.project.toString(), 'MEMBER');
    await task.deleteOne();
    return true;
  },

  async getForActor(actor: AuthUser, id: string): Promise<TaskDocument> {
    if (!isObjectId(id)) throw new AppError('Task not found', 'NOT_FOUND');
    const task = await TaskModel.findById(id);
    if (!task) throw new AppError('Task not found', 'NOT_FOUND');
    await projectService.getForActor(actor, task.project.toString(), 'VIEWER');
    return task;
  },

  async list(
    actor: AuthUser,
    args: PageArgs & { projectId?: string | null; filter?: TaskFilter | null },
  ) {
    const filter: QueryFilter<TaskDocument> = {};
    if (args.projectId) {
      const project = await projectService.getForActor(actor, args.projectId, 'VIEWER');
      filter.project = project._id;
    } else if (actor.role !== 'ADMIN') {
      const projects = await ProjectModel.find({
        $or: [{ owner: actor.id }, { 'members.user': actor.id }],
      }).select('_id');
      filter.project = { $in: projects.map((project) => project._id) };
    }

    if (args.filter?.status) filter.status = args.filter.status;
    if (args.filter?.priority) filter.priority = args.filter.priority;
    if (args.filter?.assigneeId) {
      if (!isObjectId(args.filter.assigneeId))
        throw new AppError('Assignee not found', 'NOT_FOUND');
      filter.assignee = args.filter.assigneeId;
    }
    if (args.filter?.search) {
      filter.title = new RegExp(escapeRegex(args.filter.search), 'i');
    }

    return paginate<TaskDocument>(TaskModel, filter, args);
  },
};
