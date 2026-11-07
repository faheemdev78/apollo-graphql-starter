import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { makeExecutableSchema } from '@graphql-tools/schema';
import type { GraphQLSchema } from 'graphql';
import { authDirectiveTransformer } from './directives/auth';
import { resolvers } from './resolvers';

export function loadTypeDefs(): string[] {
  const directory = path.join(__dirname, 'typeDefs');
  return readdirSync(directory)
    .filter((file) => file.endsWith('.graphql'))
    .sort()
    .map((file) => readFileSync(path.join(directory, file), 'utf8'));
}

export function buildSchema(): GraphQLSchema {
  const schema = makeExecutableSchema({
    typeDefs: loadTypeDefs(),
    resolvers,
  });
  return authDirectiveTransformer(schema);
}
