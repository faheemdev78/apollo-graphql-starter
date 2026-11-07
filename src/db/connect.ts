import mongoose from 'mongoose';
import { logger } from '../logger';

export async function connectDb(uri: string): Promise<void> {
  if (mongoose.connection.readyState === 1) return;
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  logger.info('Connected to MongoDB');
}

export async function disconnectDb(): Promise<void> {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.disconnect();
}
