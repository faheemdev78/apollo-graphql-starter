import type { GraphQLFormattedError } from 'graphql';
import { config } from '../config';
import { AppError } from './appError';

const PUBLIC_CODES = new Set([
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'BAD_USER_INPUT',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'DEPTH_LIMIT_EXCEEDED',
  'GRAPHQL_VALIDATION_FAILED',
  'GRAPHQL_PARSE_FAILED',
  'BAD_REQUEST',
]);

function unwrap(error: unknown): unknown {
  if (
    typeof error === 'object' &&
    error !== null &&
    'originalError' in error &&
    (error as { originalError?: unknown }).originalError
  ) {
    return unwrap((error as { originalError: unknown }).originalError);
  }
  return error;
}

function isAppError(error: unknown): error is AppError {
  return (
    error instanceof AppError ||
    (error instanceof Error && error.name === 'AppError' && 'code' in error)
  );
}

function stripStack(formatted: GraphQLFormattedError): GraphQLFormattedError {
  const extensions = { ...(formatted.extensions ?? {}) };
  delete extensions.stacktrace;
  return {
    message: formatted.message,
    locations: formatted.locations,
    path: formatted.path,
    extensions,
  };
}

export function formatError(
  formatted: GraphQLFormattedError,
  error: unknown,
): GraphQLFormattedError {
  const original = unwrap(error);
  if (formatted.message.startsWith('Query is too deep')) {
    return {
      message: formatted.message,
      locations: formatted.locations,
      path: formatted.path,
      extensions: { code: 'DEPTH_LIMIT_EXCEEDED', maxDepth: config.depthLimit },
    };
  }
  if (isAppError(original)) {
    return {
      message: original.message,
      locations: formatted.locations,
      path: formatted.path,
      extensions: {
        code: original.code,
        ...(original.issues ? { issues: original.issues } : {}),
      },
    };
  }

  const cleaned = stripStack(formatted);
  const code =
    typeof cleaned.extensions?.code === 'string'
      ? cleaned.extensions.code
      : 'INTERNAL_SERVER_ERROR';
  if (PUBLIC_CODES.has(code)) {
    return cleaned;
  }

  return {
    message: config.isProduction ? 'Internal server error' : formatted.message,
    locations: formatted.locations,
    path: formatted.path,
    extensions: { code: 'INTERNAL_SERVER_ERROR' },
  };
}
