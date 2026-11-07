import { afterEach, describe, expect, it } from 'vitest';
import { resetRateLimits } from '../src/graphql/plugins/rateLimit';
import { errorCode, gql, registerUser } from './helpers';

const HEALTH = /* GraphQL */ `
  query Health {
    health
  }
`;

describe('limits', () => {
  afterEach(() => {
    process.env.RATE_LIMIT_MAX = '1000';
    resetRateLimits();
  });

  it('rejects queries that exceed the configured depth', async () => {
    const user = await registerUser();
    const result = await gql({
      query: /* GraphQL */ `
        query Deep {
          projects {
            edges {
              node {
                owner {
                  projects {
                    owner {
                      name
                    }
                  }
                }
              }
            }
          }
        }
      `,
      token: user.token,
    });
    expect(errorCode(result)).toBe('DEPTH_LIMIT_EXCEEDED');
  });

  it('rate limits repeated operations for the same caller', async () => {
    process.env.RATE_LIMIT_MAX = '2';
    resetRateLimits();
    const user = await registerUser();
    const ip = '203.0.113.10';
    const first = await gql({ query: HEALTH, token: user.token, ip });
    const second = await gql({ query: HEALTH, token: user.token, ip });
    const third = await gql({ query: HEALTH, token: user.token, ip });
    expect(first.data).toEqual({ health: 'ok' });
    expect(second.errors).toBeUndefined();
    expect(errorCode(third)).toBe('RATE_LIMITED');
  });
});
