function readString(name: string, fallback: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') return fallback;
  return value;
}

function readPositiveInt(name: string, fallback: number): number {
  const parsed = Number(readString(name, String(fallback)));
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

const WEAK_SECRET = /change-me|local-dev|dev-only|replace-me|not-a-secret/i;

export const config = {
  get env(): string {
    return process.env.NODE_ENV ?? 'development';
  },
  get isProduction(): boolean {
    return this.env === 'production';
  },
  get port(): number {
    return readPositiveInt('PORT', 4000);
  },
  get mongoUri(): string {
    return readString('MONGODB_URI', 'mongodb://127.0.0.1:27017/apollo_starter');
  },
  get jwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (secret && secret.trim() !== '') return secret;
    if (this.isProduction) {
      throw new Error('JWT_SECRET is required in production');
    }
    return 'dev-only-secret-change-me';
  },
  get jwtExpiresIn(): string {
    return readString('JWT_EXPIRES_IN', '7d');
  },
  get corsOrigin(): string {
    return readString('CORS_ORIGIN', '*');
  },
  get depthLimit(): number {
    return readPositiveInt('GRAPHQL_DEPTH_LIMIT', 8);
  },
  get rateLimitMax(): number {
    return readPositiveInt('RATE_LIMIT_MAX', 100);
  },
  get rateLimitWindowMs(): number {
    return readPositiveInt('RATE_LIMIT_WINDOW_MS', 60_000);
  },
  get bcryptRounds(): number {
    if (this.env === 'test') return 4;
    return this.isProduction ? 12 : 10;
  },
};

export function assertRuntimeConfig(): void {
  if (!config.isProduction) return;
  const secret = config.jwtSecret;
  if (secret.length < 32 || WEAK_SECRET.test(secret)) {
    throw new Error('JWT_SECRET must be a unique secret of at least 32 characters in production');
  }
}
