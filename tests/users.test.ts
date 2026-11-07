import { describe, expect, it } from 'vitest';
import { errorCode, gql, registerUser, setRole } from './helpers';

const USERS = /* GraphQL */ `
  query Users($first: Int, $after: String, $search: String) {
    users(first: $first, after: $after, search: $search) {
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        cursor
        node {
          id
          email
          name
        }
      }
    }
  }
`;

describe('users', () => {
  it('paginates users with a stable cursor and supports search', async () => {
    const admin = await registerUser({ email: 'admin@example.com', name: 'Admin' });
    await setRole(admin.user.id, 'ADMIN');
    await registerUser({ email: 'maya@example.com', name: 'Maya Chen' });
    await registerUser({ email: 'leo@example.com', name: 'Leo Martins' });

    const first = await gql<{
      users: {
        totalCount: number;
        pageInfo: { hasNextPage: boolean; endCursor: string };
        edges: Array<{ node: { email: string } }>;
      };
    }>({ query: USERS, variables: { first: 2 }, token: admin.token });

    expect(first.data?.users.totalCount).toBe(3);
    expect(first.data?.users.pageInfo.hasNextPage).toBe(true);
    expect(first.data?.users.edges).toHaveLength(2);

    const second = await gql<{
      users: { edges: Array<{ node: { email: string } }>; pageInfo: { hasNextPage: boolean } };
    }>({
      query: USERS,
      variables: { first: 2, after: first.data?.users.pageInfo.endCursor },
      token: admin.token,
    });
    const seen = new Set([
      ...(first.data?.users.edges.map((edge) => edge.node.email) ?? []),
      ...(second.data?.users.edges.map((edge) => edge.node.email) ?? []),
    ]);
    expect(seen.size).toBe(3);
    expect(second.data?.users.pageInfo.hasNextPage).toBe(false);

    const search = await gql<{ users: { edges: Array<{ node: { email: string } }> } }>({
      query: USERS,
      variables: { search: 'maya' },
      token: admin.token,
    });
    expect(search.data?.users.edges.map((edge) => edge.node.email)).toEqual(['maya@example.com']);
  });

  it('lets an admin change another user role and blocks self-demotion', async () => {
    const admin = await registerUser({ email: 'admin@example.com' });
    const member = await registerUser({ email: 'maya@example.com' });
    await setRole(admin.user.id, 'ADMIN');

    const promoted = await gql<{ updateUserRole: { role: string } }>({
      query: /* GraphQL */ `
        mutation UpdateRole($id: ID!, $role: Role!) {
          updateUserRole(id: $id, role: $role) {
            role
          }
        }
      `,
      variables: { id: member.user.id, role: 'VIEWER' },
      token: admin.token,
    });
    expect(promoted.data?.updateUserRole.role).toBe('VIEWER');

    const self = await gql({
      query: /* GraphQL */ `
        mutation UpdateRole($id: ID!, $role: Role!) {
          updateUserRole(id: $id, role: $role) {
            id
          }
        }
      `,
      variables: { id: admin.user.id, role: 'MEMBER' },
      token: admin.token,
    });
    expect(errorCode(self)).toBe('FORBIDDEN');

    const denied = await gql({
      query: /* GraphQL */ `
        mutation {
          updateUserRole(id: "${admin.user.id}", role: VIEWER) {
            id
          }
        }
      `,
      token: member.token,
    });
    expect(errorCode(denied)).toBe('FORBIDDEN');
  });

  it('rejects an invalid cursor', async () => {
    const user = await registerUser();
    const result = await gql({
      query: USERS,
      variables: { after: 'not-a-cursor' },
      token: user.token,
    });
    expect(errorCode(result)).toBe('BAD_USER_INPUT');
  });
});
