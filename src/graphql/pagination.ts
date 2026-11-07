import { AppError } from '../errors/appError';
import { isObjectId } from '../utils/objectId';

export interface PageArgs {
  first?: number | null;
  after?: string | null;
}

export interface Connection<T> {
  edges: Array<{ cursor: string; node: T }>;
  pageInfo: {
    hasNextPage: boolean;
    endCursor: string | null;
  };
  totalCount: number;
}

interface CursorDoc {
  _id: { toString(): string };
  createdAt: Date;
}

interface Cursor {
  createdAt: Date;
  id: string;
}

export function encodeCursor(doc: CursorDoc): string {
  return Buffer.from(
    JSON.stringify({ c: doc.createdAt.toISOString(), i: doc._id.toString() }),
  ).toString('base64url');
}

export function decodeCursor(cursor: string): Cursor {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (typeof parsed !== 'object' || parsed === null) throw new Error('invalid');
    const record = parsed as { c?: unknown; i?: unknown };
    if (typeof record.c !== 'string' || typeof record.i !== 'string' || !isObjectId(record.i)) {
      throw new Error('invalid');
    }
    const createdAt = new Date(record.c);
    if (Number.isNaN(createdAt.getTime())) throw new Error('invalid');
    return { createdAt, id: record.i };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Invalid pagination cursor', 'BAD_USER_INPUT');
  }
}

interface LoosePageModel {
  find(filter: object): {
    sort(order: object): {
      limit(count: number): PromiseLike<CursorDoc[]>;
    };
  };
  countDocuments(filter: object): PromiseLike<number>;
}

export async function paginate<T>(
  model: object,
  filter: object,
  args: PageArgs,
): Promise<Connection<T>> {
  const first = args.first ?? 20;
  if (!Number.isInteger(first) || first < 1 || first > 100) {
    throw new AppError('`first` must be an integer between 1 and 100', 'BAD_USER_INPUT');
  }

  const base = filter as Record<string, unknown>;
  const query: Record<string, unknown> = { ...base };
  if (args.after) {
    const cursor = decodeCursor(args.after);
    const cursorClause = {
      $or: [
        { createdAt: { $lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
      ],
    };
    const existing = Array.isArray(base.$and) ? base.$and : [];
    query.$and = [...existing, cursorClause];
  }

  const pageModel = model as LoosePageModel;
  const docs = (await pageModel
    .find(query)
    .sort({ createdAt: -1, _id: -1 })
    .limit(first + 1)) as Array<T & CursorDoc>;
  const hasNextPage = docs.length > first;
  const page = hasNextPage ? docs.slice(0, first) : docs;
  const edges = page.map((node) => ({ cursor: encodeCursor(node), node }));

  return {
    edges,
    pageInfo: {
      hasNextPage,
      endCursor: edges.at(-1)?.cursor ?? null,
    },
    totalCount: await pageModel.countDocuments(filter),
  };
}
