import { AppError } from '../errors/appError';
import { UserModel } from '../modules/user/user.model';
import type { AuthUser } from '../context';
import { verifyToken } from './tokens';

export function toAuthUser(user: {
  id: string;
  email: string;
  name: string;
  role: AuthUser['role'];
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

export async function authenticate(authorization?: string): Promise<AuthUser | null> {
  if (!authorization) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(authorization.trim());
  const token = match?.[1];
  if (!token) {
    throw new AppError('Malformed Authorization header', 'UNAUTHENTICATED');
  }

  let userId: string;
  try {
    userId = verifyToken(token).sub;
  } catch {
    throw new AppError('Invalid or expired token', 'UNAUTHENTICATED');
  }

  const user = await UserModel.findById(userId);
  if (!user) {
    throw new AppError('Invalid or expired token', 'UNAUTHENTICATED');
  }

  return toAuthUser({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as AuthUser['role'],
  });
}
