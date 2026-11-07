import { requireUser } from '../../auth/guards';
import { signToken } from '../../auth/tokens';
import type { Resolvers } from '../../graphql/generated/graphql';
import { projectService } from '../project/project.service';
import { parseInput } from '../../validation/parse';
import {
  loginSchema,
  objectIdSchema,
  registerSchema,
  roleSchema,
  searchSchema,
  updateProfileSchema,
} from '../../validation/schemas';
import { AppError } from '../../errors/appError';
import { userService } from './user.service';

export const userResolvers: Resolvers = {
  Query: {
    me: async (_parent, _args, context) => {
      const actor = requireUser(context, 'VIEWER');
      const user = await userService.getById(actor.id);
      if (!user) throw new AppError('User not found', 'NOT_FOUND');
      return user;
    },
    user: async (_parent, args, context) => {
      requireUser(context, 'VIEWER');
      const id = parseInput(objectIdSchema, args.id);
      return userService.getById(id);
    },
    users: (_parent, args, context) => {
      requireUser(context, 'VIEWER');
      const search = args.search == null ? undefined : parseInput(searchSchema, args.search);
      return userService.list({ first: args.first, after: args.after, search });
    },
  },
  Mutation: {
    register: async (_parent, args) => {
      const input = parseInput(registerSchema, args.input);
      const user = await userService.register(input);
      return { token: signToken(userService.toActor(user)), user };
    },
    login: async (_parent, args) => {
      const input = parseInput(loginSchema, args.input);
      const user = await userService.login(input);
      return { token: signToken(userService.toActor(user)), user };
    },
    updateProfile: async (_parent, args, context) => {
      const actor = requireUser(context, 'VIEWER');
      const input = parseInput(updateProfileSchema, args.input);
      return userService.updateProfile(actor, input);
    },
    updateUserRole: async (_parent, args, context) => {
      const actor = requireUser(context, 'ADMIN');
      const id = parseInput(objectIdSchema, args.id);
      const role = parseInput(roleSchema, args.role);
      return userService.updateRole(actor, id, role);
    },
  },
  User: {
    projects: (user, _args, context) => {
      const actor = requireUser(context, 'VIEWER');
      return projectService.listForUser(actor, user.id);
    },
  },
};
