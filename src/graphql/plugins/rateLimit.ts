import type { ApolloServerPlugin } from '@apollo/server';
import { GraphQLError, Kind, type SelectionNode } from 'graphql';
import { config } from '../../config';
import type { GraphQLContext } from '../../context';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function resetRateLimits(): void {
  buckets.clear();
}

function isIntrospection(selections: readonly SelectionNode[]): boolean {
  const fields = selections.filter((selection) => selection.kind === Kind.FIELD);
  return fields.length > 0 && fields.every((field) => field.name.value.startsWith('__'));
}

export function createRateLimitPlugin(): ApolloServerPlugin<GraphQLContext> {
  return {
    async requestDidStart() {
      return {
        async didResolveOperation(requestContext) {
          const operation = requestContext.operation;
          if (!operation || isIntrospection(operation.selectionSet.selections)) return;

          const max = config.rateLimitMax;
          const windowMs = config.rateLimitWindowMs;
          const now = Date.now();
          const identity = requestContext.contextValue.user?.id ?? requestContext.contextValue.ip;
          const current = buckets.get(identity);

          if (!current || now >= current.resetAt) {
            buckets.set(identity, { count: 1, resetAt: now + windowMs });
            if (buckets.size > 10_000) {
              for (const [key, bucket] of buckets) {
                if (now >= bucket.resetAt) buckets.delete(key);
              }
            }
            return;
          }

          if (current.count >= max) {
            throw new GraphQLError('Rate limit exceeded. Try again shortly.', {
              extensions: {
                code: 'RATE_LIMITED',
                retryAfterMs: Math.max(0, current.resetAt - now),
              },
            });
          }

          current.count += 1;
        },
      };
    },
  };
}
