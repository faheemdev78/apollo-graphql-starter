import { describe, expect, it } from 'vitest';
import { AppError } from '../src/errors/appError';
import { errorCode, gql, registerUser } from './helpers';

const LOGIN = /* GraphQL */ `
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      token
      user {
        email
        role
      }
    }
  }
`;

const ME = /* GraphQL */ `
  query Me {
    me {
      id
      email
      role
    }
  }
`;

describe('auth', () => {
  it('registers a member and returns a token that can read me', async () => {
    const registered = await registerUser({ email: 'ada@example.com', name: 'Ada' });
    expect(registered.user).toMatchObject({ email: 'ada@example.com', role: 'MEMBER' });

    const me = await gql<{ me: { email: string } }>({ query: ME, token: registered.token });
    expect(me.data?.me.email).toBe('ada@example.com');
    expect(me.errors).toBeUndefined();
  });

  it('rejects a duplicate email', async () => {
    await registerUser({ email: 'ada@example.com' });
    const again = await gql({
      query: /* GraphQL */ `
        mutation {
          register(input: { email: "ada@example.com", name: "Ada", password: "Password123!" }) {
            token
          }
        }
      `,
    });
    expect(errorCode(again)).toBe('CONFLICT');
  });

  it('returns field issues for invalid registration input', async () => {
    const result = await gql({
      query: /* GraphQL */ `
        mutation Register($input: RegisterInput!) {
          register(input: $input) {
            token
          }
        }
      `,
      variables: { input: { email: 'not-an-email', name: '', password: 'short' } },
    });
    expect(errorCode(result)).toBe('BAD_USER_INPUT');
    const issues = result.errors?.[0]?.extensions?.issues as Array<{ path: string }>;
    expect(issues.map((issue) => issue.path)).toEqual(
      expect.arrayContaining(['email', 'name', 'password']),
    );
  });

  it('logs in with the same generic error for a bad password and an unknown email', async () => {
    await registerUser({ email: 'ada@example.com', password: 'Password123!' });
    const badPassword = await gql({
      query: LOGIN,
      variables: { input: { email: 'ada@example.com', password: 'wrong-password' } },
    });
    const unknown = await gql({
      query: LOGIN,
      variables: { input: { email: 'missing@example.com', password: 'Password123!' } },
    });
    expect(errorCode(badPassword)).toBe('UNAUTHENTICATED');
    expect(errorCode(unknown)).toBe('UNAUTHENTICATED');
    expect(badPassword.errors?.[0]?.message).toBe(unknown.errors?.[0]?.message);
  });

  it('requires authentication for me and rejects a malformed token', async () => {
    const anonymous = await gql({ query: ME });
    expect(errorCode(anonymous)).toBe('UNAUTHENTICATED');
    await expect(gql({ query: ME, token: 'not-a-jwt' })).rejects.toBeInstanceOf(AppError);
  });
});
