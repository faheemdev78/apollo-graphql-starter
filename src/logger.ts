type Level = 'info' | 'warn' | 'error';

function write(level: Level, message: string, meta?: unknown): void {
  if (process.env.NODE_ENV === 'test') return;
  const entry: Record<string, unknown> = {
    level,
    message,
    time: new Date().toISOString(),
  };
  if (meta !== undefined) {
    entry.meta = meta instanceof Error ? { name: meta.name, message: meta.message } : meta;
  }
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else console.log(line);
}

export const logger = {
  info: (message: string, meta?: unknown) => write('info', message, meta),
  warn: (message: string, meta?: unknown) => write('warn', message, meta),
  error: (message: string, meta?: unknown) => write('error', message, meta),
};
