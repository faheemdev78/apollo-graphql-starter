import { cpSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const source = path.join(process.cwd(), 'src/graphql/typeDefs');
const destination = path.join(process.cwd(), 'dist/graphql/typeDefs');

mkdirSync(path.dirname(destination), { recursive: true });
cpSync(source, destination, { recursive: true });
