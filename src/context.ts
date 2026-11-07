import { authenticate } from './auth/authenticate';
import type { Role } from './domain/enums';
import { createLoaders, type Loaders } from './loaders/createLoaders';
import { pubsub } from './pubsub';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface GraphQLContext {
  user: AuthUser | null;
  ip: string;
  loaders: Loaders;
  pubsub: typeof pubsub;
}

export async function buildContext(input: {
  authorization?: string;
  ip: string;
}): Promise<GraphQLContext> {
  const user = await authenticate(input.authorization);
  return {
    user,
    ip: input.ip,
    loaders: createLoaders(),
    pubsub,
  };
}
