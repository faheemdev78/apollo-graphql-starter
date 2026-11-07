import { ROLE_RANK, type Role } from '../domain/enums';
import { AppError } from '../errors/appError';
import type { AuthUser, GraphQLContext } from '../context';

export function requireUser(context: GraphQLContext, minimum: Role = 'VIEWER'): AuthUser {
  if (!context.user) {
    throw new AppError('Authentication required', 'UNAUTHENTICATED');
  }
  if (ROLE_RANK[context.user.role] < ROLE_RANK[minimum]) {
    throw new AppError('Insufficient permissions', 'FORBIDDEN');
  }
  return context.user;
}
