import { createClient, type Client } from 'graphql-ws';
import { describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { startServer } from '../src/server';
import { gql, registerUser } from './helpers';

function waitForConnected(client: Client): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for websocket')), 5_000);
    const unsubscribe = client.on('connected', () => {
      clearTimeout(timeout);
      unsubscribe();
      resolve();
    });
  });
}

describe('subscriptions', () => {
  it('serves health over HTTP and pushes task updates over graphql-ws', async () => {
    const server = await startServer(0);
    const owner = await registerUser({ email: 'owner@example.com' });
    const created = await gql<{ createProject: { id: string } }>({
      query: /* GraphQL */ `
        mutation ($input: CreateProjectInput!) {
          createProject(input: $input) {
            id
          }
        }
      `,
      variables: { input: { name: 'Live board', key: 'LIVE' } },
      token: owner.token,
    });
    const projectId = created.data!.createProject.id;
    const client = createClient({
      url: `ws://127.0.0.1:${server.port}/graphql`,
      webSocketImpl: WebSocket,
      connectionParams: { authorization: `Bearer ${owner.token}` },
      retryAttempts: 0,
    });
    const connected = waitForConnected(client);

    try {
      const health = await fetch(`http://127.0.0.1:${server.port}/health`);
      expect(health.status).toBe(200);
      await expect(health.json()).resolves.toEqual({ status: 'ok' });

      const update = new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('subscription timed out')), 5_000);
        client.subscribe<{ taskUpdated: { title: string; status: string } }>(
          {
            query: /* GraphQL */ `
              subscription ($projectId: ID!) {
                taskUpdated(projectId: $projectId) {
                  title
                  status
                }
              }
            `,
            variables: { projectId },
          },
          {
            next: (value) => {
              clearTimeout(timeout);
              resolve(value.data?.taskUpdated.title ?? '');
            },
            error: (error) => {
              clearTimeout(timeout);
              reject(error instanceof Error ? error : new Error('subscription error'));
            },
            complete: () => undefined,
          },
        );
      });

      await connected;
      await new Promise((resolve) => setTimeout(resolve, 150));

      const task = await gql<{ createTask: { title: string } }>({
        query: /* GraphQL */ `
          mutation ($input: CreateTaskInput!) {
            createTask(input: $input) {
              title
            }
          }
        `,
        variables: { input: { projectId, title: 'Broadcast me', status: 'TODO' } },
        token: owner.token,
      });
      expect(task.data?.createTask.title).toBe('Broadcast me');
      await expect(update).resolves.toBe('Broadcast me');
    } finally {
      await client.dispose();
      await server.close();
    }
  });
});
