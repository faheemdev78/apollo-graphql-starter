import 'dotenv/config';
import { assertRuntimeConfig, config } from './config';
import { connectDb, disconnectDb } from './db/connect';
import { logger } from './logger';
import { startServer } from './server';

async function main(): Promise<void> {
  assertRuntimeConfig();
  await connectDb(config.mongoUri);
  const server = await startServer(config.port);

  const shutdown = async (signal: string) => {
    logger.info('Shutting down', { signal });
    await server.close();
    await disconnectDb();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

main().catch((error: unknown) => {
  logger.error('Failed to start', error);
  console.error(error);
  process.exit(1);
});
