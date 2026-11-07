import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { ProjectModel } from '../src/modules/project/project.model';
import { errorCode, gql, registerUser, setRole } from './helpers';

const CREATE_PROJECT = /* GraphQL */ `
  mutation CreateProject($input: CreateProjectInput!) {
    createProject(input: $input) {
      id
      key
      name
      owner {
        email
      }
      members {
        role
        user {
          email
        }
      }
    }
  }
`;

describe('projects', () => {
  it('creates a project for the owner and hides it from outsiders', async () => {
    const owner = await registerUser({ email: 'owner@example.com' });
    const outsider = await registerUser({ email: 'outsider@example.com' });
    const created = await gql<{
      createProject: { id: string; key: string; members: Array<{ role: string }> };
    }>({
      query: CREATE_PROJECT,
      variables: { input: { name: 'Platform', key: 'plat', description: 'Core' } },
      token: owner.token,
    });
    expect(created.data?.createProject.key).toBe('PLAT');
    expect(created.data?.createProject.members).toEqual([
      expect.objectContaining({ role: 'ADMIN' }),
    ]);

    const hidden = await gql({
      query: /* GraphQL */ `
        query ($id: ID!) {
          project(id: $id) {
            id
          }
        }
      `,
      variables: { id: created.data?.createProject.id },
      token: outsider.token,
    });
    expect(errorCode(hidden)).toBe('NOT_FOUND');

    const duplicate = await gql({
      query: CREATE_PROJECT,
      variables: { input: { name: 'Other', key: 'plat' } },
      token: owner.token,
    });
    expect(errorCode(duplicate)).toBe('CONFLICT');
  });

  it('paginates visible projects and lets the owner manage members', async () => {
    const owner = await registerUser({ email: 'owner@example.com' });
    const member = await registerUser({ email: 'member@example.com' });
    const ids: string[] = [];
    for (const key of ['AA', 'BB', 'CC']) {
      const created = await gql<{ createProject: { id: string } }>({
        query: CREATE_PROJECT,
        variables: { input: { name: `Project ${key}`, key } },
        token: owner.token,
      });
      ids.push(created.data!.createProject.id);
    }
    const stamps = [new Date('2024-03-01'), new Date('2024-02-01'), new Date('2024-01-01')];
    for (const [index, id] of ids.entries()) {
      const createdAt = stamps[index];
      if (!createdAt) throw new Error('missing timestamp');
      await ProjectModel.collection.updateOne(
        { _id: new mongoose.Types.ObjectId(id) },
        { $set: { createdAt } },
      );
    }

    const page = await gql<{
      projects: {
        totalCount: number;
        pageInfo: { hasNextPage: boolean; endCursor: string };
        edges: Array<{ node: { key: string } }>;
      };
    }>({
      query: /* GraphQL */ `
        query ($first: Int, $after: String) {
          projects(first: $first, after: $after) {
            totalCount
            pageInfo {
              hasNextPage
              endCursor
            }
            edges {
              node {
                key
              }
            }
          }
        }
      `,
      variables: { first: 2 },
      token: owner.token,
    });
    expect(page.data?.projects.totalCount).toBe(3);
    expect(page.data?.projects.edges.map((edge) => edge.node.key)).toEqual(['AA', 'BB']);

    const added = await gql<{ addProjectMember: { members: Array<{ user: { email: string } }> } }>({
      query: /* GraphQL */ `
        mutation ($input: AddProjectMemberInput!) {
          addProjectMember(input: $input) {
            members {
              role
              user {
                email
              }
            }
          }
        }
      `,
      variables: { input: { projectId: ids[0], userId: member.user.id, role: 'MEMBER' } },
      token: owner.token,
    });
    expect(added.data?.addProjectMember.members.map((item) => item.user.email)).toContain(
      'member@example.com',
    );

    const outsider = await registerUser({ email: 'outsider@example.com' });
    const denied = await gql({
      query: /* GraphQL */ `
        mutation ($input: AddProjectMemberInput!) {
          addProjectMember(input: $input) {
            id
          }
        }
      `,
      variables: { input: { projectId: ids[0], userId: outsider.user.id, role: 'VIEWER' } },
      token: member.token,
    });
    expect(errorCode(denied)).toBe('FORBIDDEN');
  });

  it('blocks viewers from creating projects', async () => {
    const viewer = await registerUser({ email: 'viewer@example.com' });
    await setRole(viewer.user.id, 'VIEWER');
    const result = await gql({
      query: CREATE_PROJECT,
      variables: { input: { name: 'Nope', key: 'NOPE' } },
      token: viewer.token,
    });
    expect(errorCode(result)).toBe('FORBIDDEN');
  });
});
