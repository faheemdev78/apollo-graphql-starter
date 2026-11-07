import { readFileSync } from 'node:fs';
import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { resetRateLimits } from '../src/graphql/plugins/rateLimit';
import { ProjectModel } from '../src/modules/project/project.model';
import { TaskModel } from '../src/modules/task/task.model';
import { UserModel } from '../src/modules/user/user.model';
import { createApolloServer } from '../src/server';
import { mongoUriFile } from './globalSetup';
import { state } from './state';

beforeAll(async () => {
  const uri = readFileSync(mongoUriFile, 'utf8').trim();
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }
  await Promise.all([UserModel.init(), ProjectModel.init(), TaskModel.init()]);
  if (!state.apollo) {
    state.apollo = createApolloServer();
    await state.apollo.start();
  }
});

afterEach(async () => {
  resetRateLimits();
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await state.apollo?.stop();
  state.apollo = null;
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});
