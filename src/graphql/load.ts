import type { GraphQLContext } from '../context';
import { AppError } from '../errors/appError';
import type { ProjectDocument } from '../modules/project/project.model';
import type { UserDocument } from '../modules/user/user.model';

export async function requireLoadedUser(
  context: GraphQLContext,
  id: unknown,
): Promise<UserDocument> {
  const user = await context.loaders.userById.load(String(id));
  if (!user) throw new AppError('User not found', 'NOT_FOUND');
  return user;
}

export async function requireLoadedProject(
  context: GraphQLContext,
  id: unknown,
): Promise<ProjectDocument> {
  const project = await context.loaders.projectById.load(String(id));
  if (!project) throw new AppError('Project not found', 'NOT_FOUND');
  return project;
}
