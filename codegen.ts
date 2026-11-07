import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: 'src/graphql/typeDefs/**/*.graphql',
  generates: {
    'src/graphql/generated/graphql.ts': {
      plugins: ['typescript', 'typescript-resolvers'],
      config: {
        contextType: '../../context#GraphQLContext',
        useTypeImports: true,
        enumsAsTypes: true,
        useIndexSignature: true,
        makeResolverTypeCallable: true,
        immutableTypes: false,
        scalars: {
          DateTime: 'Date',
        },
        mappers: {
          User: '../../modules/user/user.model#UserDocument',
          Project: '../../modules/project/project.model#ProjectDocument',
          ProjectMember: '../../modules/project/project.model#ProjectMemberParent',
          Task: '../../modules/task/task.model#TaskDocument',
        },
      },
    },
  },
};

export default config;
