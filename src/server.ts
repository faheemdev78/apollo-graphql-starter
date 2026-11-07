import { ApolloServer, type ApolloServerPlugin } from '@apollo/server';
import { ApolloServerPluginLandingPageDisabled } from '@apollo/server/plugin/disabled';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { expressMiddleware } from '@apollo/server/express4';
import cors from 'cors';
import express from 'express';
import { useServer } from 'graphql-ws/use/ws';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { config } from './config';
import { buildContext, type GraphQLContext } from './context';
import { formatError } from './errors/formatError';
import { depthLimit } from './graphql/depthLimit';
import { createRateLimitPlugin } from './graphql/plugins/rateLimit';
import { buildSchema } from './graphql/schema';
import { logger } from './logger';

type ConnectionParams = { authorization?: string };

function landingPlugin(): ApolloServerPlugin<GraphQLContext> {
  if (config.env === 'development') {
    return ApolloServerPluginLandingPageLocalDefault({ embed: true, footer: false });
  }
  return ApolloServerPluginLandingPageDisabled();
}

function sharedApolloConfig(plugins: ApolloServerPlugin<GraphQLContext>[]) {
  return {
    schema: buildSchema(),
    plugins,
    validationRules: [depthLimit(config.depthLimit)],
    formatError,
    includeStacktraceInErrorResponses: false,
    introspection: !config.isProduction,
  };
}

export function createApolloServer(): ApolloServer<GraphQLContext> {
  return new ApolloServer<GraphQLContext>(
    sharedApolloConfig([createRateLimitPlugin(), landingPlugin()]),
  );
}

export async function startServer(port = config.port): Promise<{
  url: string;
  port: number;
  close: () => Promise<void>;
}> {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',') }));
  app.get('/health', (_request, response) => {
    response.status(200).json({ status: 'ok' });
  });

  const httpServer = createServer(app);
  const schema = buildSchema();
  const wsServer = new WebSocketServer({ server: httpServer, path: '/graphql' });
  const cleanup = useServer<ConnectionParams>(
    {
      schema,
      context: async (ctx) => {
        const authorization = ctx.connectionParams?.authorization;
        return buildContext({
          authorization: typeof authorization === 'string' ? authorization : undefined,
          ip: ctx.extra.request.socket.remoteAddress ?? 'unknown',
        });
      },
    },
    wsServer,
  );

  const apollo = new ApolloServer<GraphQLContext>({
    ...sharedApolloConfig([
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await cleanup.dispose();
            },
          };
        },
      },
      createRateLimitPlugin(),
      landingPlugin(),
    ]),
    schema,
  });

  await apollo.start();
  app.use(
    '/graphql',
    express.json({ limit: '100kb' }),
    expressMiddleware(apollo, {
      context: async ({ req }) => {
        const header = req.headers.authorization;
        return buildContext({
          authorization: Array.isArray(header) ? header[0] : header,
          ip: req.ip || req.socket.remoteAddress || 'unknown',
        });
      },
    }),
  );

  await new Promise<void>((resolve) => {
    httpServer.listen(port, resolve);
  });

  const address = httpServer.address();
  const boundPort = typeof address === 'object' && address ? address.port : port;
  const url = `http://127.0.0.1:${boundPort}/graphql`;
  logger.info('GraphQL server listening', { url });

  return {
    url,
    port: boundPort,
    close: async () => {
      await apollo.stop();
    },
  };
}
