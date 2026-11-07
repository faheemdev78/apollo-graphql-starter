import type { ApolloServer } from '@apollo/server';
import type { GraphQLContext } from '../src/context';

export const state: { apollo: ApolloServer<GraphQLContext> | null } = {
  apollo: null,
};
