import type { QueryFilter } from 'mongoose';
import type { AuthUser } from '../../context';
import { ROLE_RANK, type Role } from '../../domain/enums';
import { AppError, isDuplicateKey } from '../../errors/appError';
import { paginate, type PageArgs } from '../../graphql/pagination';
import { TaskModel } from '../task/task.model';
import { UserModel } from '../user/user.model';
import { escapeRegex } from '../../utils/regex';
import { isObjectId } from '../../utils/objectId';
import { ProjectModel, type ProjectDocument } from './project.model';

export interface CreateProjectInput {
  name: string;
  key: string;
  description?: string | null;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
}

function membership(project: ProjectDocument, userId: string) {
  return project.members.find((member) => member.user.toString() === userId);
}

export function assertProjectAccess(
  actor: AuthUser,
  project: ProjectDocument,
  minimum: Role,
): void {
  if (actor.role === 'ADMIN') return;
  const member = membership(project, actor.id);
  const effective =
    project.owner.toString() === actor.id ? 'ADMIN' : (member?.role as Role | undefined);
  if (!effective) throw new AppError('Project not found', 'NOT_FOUND');
  if (ROLE_RANK[effective] < ROLE_RANK[minimum]) {
    throw new AppError('Insufficient permissions for this project', 'FORBIDDEN');
  }
}

export const projectService = {
  async create(actor: AuthUser, input: CreateProjectInput): Promise<ProjectDocument> {
    try {
      return await ProjectModel.create({
        name: input.name,
        key: input.key,
        description: input.description ?? null,
        owner: actor.id,
        members: [{ user: actor.id, role: 'ADMIN', joinedAt: new Date() }],
      });
    } catch (error) {
      if (isDuplicateKey(error)) {
        throw new AppError('A project with that key already exists', 'CONFLICT');
      }
      throw error;
    }
  },

  async getForActor(
    actor: AuthUser,
    id: string,
    minimum: Role = 'VIEWER',
  ): Promise<ProjectDocument> {
    if (!isObjectId(id)) throw new AppError('Project not found', 'NOT_FOUND');
    const project = await ProjectModel.findById(id);
    if (!project) throw new AppError('Project not found', 'NOT_FOUND');
    assertProjectAccess(actor, project, minimum);
    return project;
  },

  async update(actor: AuthUser, id: string, input: UpdateProjectInput): Promise<ProjectDocument> {
    const project = await this.getForActor(actor, id, 'ADMIN');
    if (input.name !== undefined) project.name = input.name;
    if (input.description !== undefined) project.description = input.description;
    await project.save();
    return project;
  },

  async remove(actor: AuthUser, id: string): Promise<boolean> {
    const project = await this.getForActor(actor, id, 'ADMIN');
    await TaskModel.deleteMany({ project: project._id });
    await project.deleteOne();
    return true;
  },

  async addMember(
    actor: AuthUser,
    input: { projectId: string; userId: string; role: Role },
  ): Promise<ProjectDocument> {
    const project = await this.getForActor(actor, input.projectId, 'ADMIN');
    if (project.owner.toString() === input.userId) {
      throw new AppError('Change the owner through a dedicated transfer', 'BAD_USER_INPUT');
    }
    const user = await UserModel.findById(input.userId);
    if (!user) throw new AppError('User not found', 'NOT_FOUND');

    const existing = membership(project, input.userId);
    if (existing) {
      existing.role = input.role;
    } else {
      project.members.push({ user: user._id, role: input.role, joinedAt: new Date() });
    }
    await project.save();
    return project;
  },

  async removeMember(actor: AuthUser, projectId: string, userId: string): Promise<ProjectDocument> {
    if (!isObjectId(userId)) throw new AppError('User not found', 'NOT_FOUND');
    const project = await this.getForActor(actor, projectId, 'ADMIN');
    if (project.owner.toString() === userId) {
      throw new AppError('The project owner cannot be removed', 'BAD_USER_INPUT');
    }
    const next = project.members.filter((member) => member.user.toString() !== userId);
    if (next.length === project.members.length) {
      throw new AppError('Member not found', 'NOT_FOUND');
    }
    project.members.splice(0, project.members.length, ...next);
    await project.save();
    return project;
  },

  list(actor: AuthUser, args: PageArgs & { search?: string | null }) {
    const filter: QueryFilter<ProjectDocument> = {};
    const visibility =
      actor.role === 'ADMIN' ? null : { $or: [{ owner: actor.id }, { 'members.user': actor.id }] };
    if (args.search) {
      const regex = new RegExp(escapeRegex(args.search), 'i');
      const search = { $or: [{ name: regex }, { key: regex }] };
      if (visibility) filter.$and = [visibility, search];
      else Object.assign(filter, search);
    } else if (visibility) {
      Object.assign(filter, visibility);
    }
    return paginate<ProjectDocument>(ProjectModel, filter, args);
  },

  async listForUser(actor: AuthUser, userId: string): Promise<ProjectDocument[]> {
    if (!isObjectId(userId)) return [];
    const theirs = { $or: [{ owner: userId }, { 'members.user': userId }] };
    const filter: QueryFilter<ProjectDocument> =
      actor.role === 'ADMIN' || actor.id === userId
        ? theirs
        : { $and: [theirs, { $or: [{ owner: actor.id }, { 'members.user': actor.id }] }] };
    return ProjectModel.find(filter).sort({ createdAt: -1, _id: -1 });
  },
};
