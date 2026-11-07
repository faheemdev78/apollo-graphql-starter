import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { MongoMemoryServer } from 'mongodb-memory-server';

export const mongoUriFile = path.join(tmpdir(), 'apollo-starter-mongo-uri.txt');

let mongo: MongoMemoryServer;

export async function setup(): Promise<void> {
  mongo = await MongoMemoryServer.create();
  writeFileSync(mongoUriFile, mongo.getUri(), 'utf8');
}

export async function teardown(): Promise<void> {
  if (mongo) await mongo.stop();
}
