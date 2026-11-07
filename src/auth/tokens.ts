import jwt, { type SignOptions } from 'jsonwebtoken';
import { config } from '../config';
import { isRole, type Role } from '../domain/enums';

export interface TokenPayload {
  sub: string;
  email: string;
  role: Role;
}

export function signToken(user: { id: string; email: string; role: Role }): string {
  const payload: TokenPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
  };
  const options: SignOptions = {
    expiresIn: config.jwtExpiresIn as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, config.jwtSecret, options);
}

export function verifyToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, config.jwtSecret);
  if (typeof decoded === 'string' || decoded === null) {
    throw new Error('Invalid token payload');
  }
  const sub = typeof decoded.sub === 'string' ? decoded.sub : '';
  const email = typeof decoded.email === 'string' ? decoded.email : '';
  const role = typeof decoded.role === 'string' ? decoded.role : '';
  if (!sub || !email || !isRole(role)) {
    throw new Error('Invalid token payload');
  }
  return { sub, email, role };
}
