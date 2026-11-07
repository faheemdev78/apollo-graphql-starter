import type { ZodType } from 'zod';
import { AppError } from '../errors/appError';

export function parseInput<T>(schema: ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new AppError(
      'Validation failed',
      'BAD_USER_INPUT',
      parsed.error.issues.map((issue) => ({
        path: issue.path.map(String).join('.') || '(root)',
        message: issue.message,
      })),
    );
  }
  return parsed.data;
}
