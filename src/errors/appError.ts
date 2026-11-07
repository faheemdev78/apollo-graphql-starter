export interface FieldIssue {
  path: string;
  message: string;
}

export class AppError extends Error {
  readonly code: string;
  readonly issues?: FieldIssue[];

  constructor(message: string, code: string, issues?: FieldIssue[]) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.issues = issues;
  }
}

export function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 11000
  );
}
