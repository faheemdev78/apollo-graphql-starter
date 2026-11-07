import { randomUUID } from 'node:crypto';
import type { FormattedExecutionResult } from 'graphql';
import { buildContext } from '../src/context';
import { UserModel } from '../src/modules/user/user.model';
import type { Role } from '../src/domain/enums';
import { state } from './state';

interface GqlOptions {
  query: string;
  variables?: Record<string, unknown>;
  token?: string;
  ip?: string;
}

export async function gql<TData = Record<string, unknown>>(
  options: GqlOptions,
): Promise<FormattedExecutionResult<TData>> {
  const apollo = state.apollo;
  if (!apollo) throw new Error('Apollo test server is not ready');
  const contextValue = await buildContext({
    authorization: options.token ? `Bearer ${options.token}` : undefined,
    ip: options.ip ?? '127.0.0.1',
  });
  const response = await apollo.executeOperation<TData>(
    { query: options.query, variables: options.variables },
    { contextValue },
  );
  if (response.body.kind !== 'single') {
    throw new Error('Expected a single GraphQL result');
  }
  return response.body.singleResult;
}

export function errorCode(result: FormattedExecutionResult): string | undefined {
  const code = result.errors?.[0]?.extensions?.code;
  return typeof code === 'string' ? code : undefined;
}

const REGISTER = /* GraphQL */ `
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      token
      user {
        id
        email
        name
        role
      }
    }
  }
`;

export async function registerUser(overrides?: {
  email?: string;
  name?: string;
  password?: string;
}) {
  const input = {
    email: overrides?.email ?? `user-${randomUUID()}@example.com`,
    name: overrides?.name ?? 'Test User',
    password: overrides?.password ?? 'Password123!',
  };
  const result = await gql<{
    register: { token: string; user: { id: string; email: string; name: string; role: Role } };
  }>({ query: REGISTER, variables: { input } });
  if (!result.data?.register) {
    throw new Error(`Failed to register: ${JSON.stringify(result.errors)}`);
  }
  return result.data.register;
}

export async function setRole(userId: string, role: Role): Promise<void> {
  await UserModel.updateOne({ _id: userId }, { role });
}
