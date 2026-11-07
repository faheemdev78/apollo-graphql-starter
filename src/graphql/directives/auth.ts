import { getDirective, MapperKind, mapSchema } from '@graphql-tools/utils';
import { defaultFieldResolver, type GraphQLSchema } from 'graphql';
import { requireUser } from '../../auth/guards';
import type { GraphQLContext } from '../../context';
import { isRole, type Role } from '../../domain/enums';

export function authDirectiveTransformer(schema: GraphQLSchema): GraphQLSchema {
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
      const auth = getDirective(schema, fieldConfig, 'auth')?.[0];
      if (!auth) return fieldConfig;

      const requested = typeof auth.requires === 'string' ? auth.requires : 'MEMBER';
      const minimum: Role = isRole(requested) ? requested : 'MEMBER';
      const resolve = fieldConfig.resolve ?? defaultFieldResolver;

      fieldConfig.resolve = (source, args, context: GraphQLContext, info) => {
        requireUser(context, minimum);
        return resolve(source, args, context, info);
      };

      return fieldConfig;
    },
  });
}
