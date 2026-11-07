import { requireUser } from '../../auth/guards';
import type { Resolvers } from '../../graphql/generated/graphql';
import { requireLoadedUser } from '../../graphql/load';
import { assertProjectAccess } from './project.service';
import { taskService } from '../task/task.service';
import { parseInput } from '../../validation/parse';
import {
  addProjectMemberSchema,
  createProjectSchema,
  objectIdSchema,
  searchSchema,
  taskFilterSchema,
  updateProjectSchema,
} from '../../validation/schemas';
import { projectService } from './project.service';

export const projectResolvers: Resolvers = {
  Query: {
    project: async (_parent, args, context) => {
      const actor = requireUser(context, 'VIEWER');
      const id = parseInput(objectIdSchema, args.id);
      return projectService.getForActor(actor, id, 'VIEWER');
    },
    projects: (_parent, args, context) => {
      const actor = requireUser(context, 'VIEWER');
      const search = args.search == null ? undefined : parseInput(searchSchema, args.search);
      return projectService.list(actor, { first: args.first, after: args.after, search });
    },
  },
  Mutation: {
    createProject: async (_parent, args, context) => {
      const actor = requireUser(context, 'MEMBER');
      const input = parseInput(createProjectSchema, args.input);
      return projectService.create(actor, input);
    },
    updateProject: async (_parent, args, context) => {
      const actor = requireUser(context, 'MEMBER');
      const id = parseInput(objectIdSchema, args.id);
      const input = parseInput(updateProjectSchema, args.input);
      return projectService.update(actor, id, input);
    },
    deleteProject: async (_parent, args, context) => {
      const actor = requireUser(context, 'MEMBER');
      const id = parseInput(objectIdSchema, args.id);
      return projectService.remove(actor, id);
    },
    addProjectMember: async (_parent, args, context) => {
      const actor = requireUser(context, 'MEMBER');
      const input = parseInput(addProjectMemberSchema, args.input);
      return projectService.addMember(actor, input);
    },
    removeProjectMember: async (_parent, args, context) => {
      const actor = requireUser(context, 'MEMBER');
      const projectId = parseInput(objectIdSchema, args.projectId);
      const userId = parseInput(objectIdSchema, args.userId);
      return projectService.removeMember(actor, projectId, userId);
    },
  },
  Project: {
    owner: (project, _args, context) => requireLoadedUser(context, project.owner),
    tasks: (project, args, context) => {
      const actor = requireUser(context, 'VIEWER');
      assertProjectAccess(actor, project, 'VIEWER');
      const filter = args.filter ? parseInput(taskFilterSchema, args.filter) : undefined;
      return taskService.list(actor, {
        projectId: project.id,
        first: args.first,
        after: args.after,
        filter,
      });
    },
  },
  ProjectMember: {
    user: (member, _args, context) => requireLoadedUser(context, member.user),
  },
};
