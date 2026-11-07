import { describe, expect, it, vi } from 'vitest';
import { UserModel } from '../src/modules/user/user.model';
import { errorCode, gql, registerUser } from './helpers';

const CREATE_PROJECT = /* GraphQL */ `
  mutation ($input: CreateProjectInput!) {
    createProject(input: $input) {
      id
    }
  }
`;

const CREATE_TASK = /* GraphQL */ `
  mutation ($input: CreateTaskInput!) {
    createTask(input: $input) {
      id
      title
      status
      priority
      assignee {
        email
      }
      reporter {
        email
      }
    }
  }
`;

async function projectFor(token: string, key = 'TASK'): Promise<string> {
  const created = await gql<{ createProject: { id: string } }>({
    query: CREATE_PROJECT,
    variables: { input: { name: 'Task board', key } },
    token,
  });
  return created.data!.createProject.id;
}

describe('tasks', () => {
  it('creates, filters, updates, and deletes tasks for project members', async () => {
    const owner = await registerUser({ email: 'owner@example.com' });
    const member = await registerUser({ email: 'maya@example.com' });
    const projectId = await projectFor(owner.token);
    await gql({
      query: /* GraphQL */ `
        mutation ($input: AddProjectMemberInput!) {
          addProjectMember(input: $input) {
            id
          }
        }
      `,
      variables: { input: { projectId, userId: member.user.id, role: 'MEMBER' } },
      token: owner.token,
    });

    const created = await gql<{ createTask: { id: string; assignee: { email: string } } }>({
      query: CREATE_TASK,
      variables: {
        input: {
          projectId,
          title: 'Ship pagination',
          priority: 'HIGH',
          assigneeId: member.user.id,
          labels: ['api'],
        },
      },
      token: owner.token,
    });
    expect(created.data?.createTask.assignee.email).toBe('maya@example.com');
    const taskId = created.data!.createTask.id;

    await gql({
      query: CREATE_TASK,
      variables: { input: { projectId, title: 'Write docs', status: 'DONE', priority: 'LOW' } },
      token: member.token,
    });

    const filtered = await gql<{
      tasks: { totalCount: number; edges: Array<{ node: { title: string } }> };
    }>({
      query: /* GraphQL */ `
        query ($projectId: ID!, $filter: TaskFilter) {
          tasks(projectId: $projectId, filter: $filter) {
            totalCount
            edges {
              node {
                title
                status
              }
            }
          }
        }
      `,
      variables: { projectId, filter: { status: 'DONE' } },
      token: member.token,
    });
    expect(filtered.data?.tasks.totalCount).toBe(1);
    expect(filtered.data?.tasks.edges[0]?.node.title).toBe('Write docs');

    const updated = await gql<{ updateTask: { status: string; assignee: null } }>({
      query: /* GraphQL */ `
        mutation ($id: ID!, $input: UpdateTaskInput!) {
          updateTask(id: $id, input: $input) {
            status
            assignee {
              id
            }
          }
        }
      `,
      variables: { id: taskId, input: { status: 'IN_REVIEW', assigneeId: null } },
      token: member.token,
    });
    expect(updated.data?.updateTask.status).toBe('IN_REVIEW');
    expect(updated.data?.updateTask.assignee).toBeNull();

    const removed = await gql<{ deleteTask: boolean }>({
      query: /* GraphQL */ `
        mutation ($id: ID!) {
          deleteTask(id: $id)
        }
      `,
      variables: { id: taskId },
      token: owner.token,
    });
    expect(removed.data?.deleteTask).toBe(true);
  });

  it('rejects a project viewer and batches user lookups', async () => {
    const owner = await registerUser({ email: 'owner@example.com' });
    const viewer = await registerUser({ email: 'viewer@example.com' });
    const other = await registerUser({ email: 'other@example.com' });
    const projectId = await projectFor(owner.token, 'BATCH');
    await gql({
      query: /* GraphQL */ `
        mutation ($input: AddProjectMemberInput!) {
          addProjectMember(input: $input) {
            id
          }
        }
      `,
      variables: { input: { projectId, userId: viewer.user.id, role: 'VIEWER' } },
      token: owner.token,
    });
    await gql({
      query: /* GraphQL */ `
        mutation ($input: AddProjectMemberInput!) {
          addProjectMember(input: $input) {
            id
          }
        }
      `,
      variables: { input: { projectId, userId: other.user.id, role: 'MEMBER' } },
      token: owner.token,
    });

    const denied = await gql({
      query: CREATE_TASK,
      variables: { input: { projectId, title: 'Not allowed' } },
      token: viewer.token,
    });
    expect(errorCode(denied)).toBe('FORBIDDEN');

    await gql({
      query: CREATE_TASK,
      variables: { input: { projectId, title: 'One', assigneeId: viewer.user.id } },
      token: owner.token,
    });
    await gql({
      query: CREATE_TASK,
      variables: { input: { projectId, title: 'Two', assigneeId: other.user.id } },
      token: owner.token,
    });

    const find = vi.spyOn(UserModel, 'find');
    const loaded = await gql({
      query: /* GraphQL */ `
        query ($projectId: ID!) {
          tasks(projectId: $projectId) {
            edges {
              node {
                reporter {
                  id
                }
                assignee {
                  id
                }
              }
            }
          }
        }
      `,
      variables: { projectId },
      token: viewer.token,
    });
    expect(loaded.errors).toBeUndefined();
    const userFinds = find.mock.calls.length;
    find.mockRestore();
    expect(userFinds).toBe(1);
  });

  it('rejects an assignee who is not a project member', async () => {
    const owner = await registerUser({ email: 'owner@example.com' });
    const stranger = await registerUser({ email: 'stranger@example.com' });
    const projectId = await projectFor(owner.token, 'OWN');
    const result = await gql({
      query: CREATE_TASK,
      variables: { input: { projectId, title: 'Nope', assigneeId: stranger.user.id } },
      token: owner.token,
    });
    expect(errorCode(result)).toBe('BAD_USER_INPUT');
  });
});
