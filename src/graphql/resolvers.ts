import { DateTimeResolver } from 'graphql-scalars';
import { projectResolvers } from '../modules/project/project.resolvers';
import { taskResolvers } from '../modules/task/task.resolvers';
import { userResolvers } from '../modules/user/user.resolvers';
import type { Resolvers } from './generated/graphql';

export const resolvers: Resolvers = {
  DateTime: DateTimeResolver,
  Query: {
    health: () => 'ok',
    me: userResolvers.Query?.me,
    user: userResolvers.Query?.user,
    users: userResolvers.Query?.users,
    project: projectResolvers.Query?.project,
    projects: projectResolvers.Query?.projects,
    task: taskResolvers.Query?.task,
    tasks: taskResolvers.Query?.tasks,
  },
  Mutation: {
    register: userResolvers.Mutation?.register,
    login: userResolvers.Mutation?.login,
    updateProfile: userResolvers.Mutation?.updateProfile,
    updateUserRole: userResolvers.Mutation?.updateUserRole,
    createProject: projectResolvers.Mutation?.createProject,
    updateProject: projectResolvers.Mutation?.updateProject,
    deleteProject: projectResolvers.Mutation?.deleteProject,
    addProjectMember: projectResolvers.Mutation?.addProjectMember,
    removeProjectMember: projectResolvers.Mutation?.removeProjectMember,
    createTask: taskResolvers.Mutation?.createTask,
    updateTask: taskResolvers.Mutation?.updateTask,
    deleteTask: taskResolvers.Mutation?.deleteTask,
  },
  Subscription: {
    taskUpdated: taskResolvers.Subscription?.taskUpdated,
  },
  User: userResolvers.User,
  Project: projectResolvers.Project,
  ProjectMember: projectResolvers.ProjectMember,
  Task: taskResolvers.Task,
};
