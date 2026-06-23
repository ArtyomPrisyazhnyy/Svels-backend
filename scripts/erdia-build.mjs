import { spawnSync } from 'node:child_process';

process.env.NODE_OPTIONS = '-r ts-node/register';

const result = spawnSync(
  'npx',
  ['erdia', 'build', '-c', '.erdiarc'],
  { stdio: 'inherit', shell: true, cwd: process.cwd() },
);

process.exit(result.status ?? 1);
