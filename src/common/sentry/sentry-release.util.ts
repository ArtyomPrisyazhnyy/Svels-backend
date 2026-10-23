import { readFileSync } from 'fs';
import { join } from 'path';

export function resolveSentryRelease(): string {
  const fromEnv = process.env.SENTRY_RELEASE?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  try {
    const packageJsonPath = join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      version?: string;
    };
    return packageJson.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}
