import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = readdirSync(new URL('../tests/', import.meta.url))
  .filter(name => /^(?:ai-event-search-.*|ai-search-.*|event-relevance|event-search-quality|event-availability|event-commerce|event-date-time)\.test\.mjs$/.test(name))
  .sort()
  .map(name => `tests/${name}`);
// Explicit filenames also work on Windows/Node 20 without shell glob expansion.
const result = spawnSync(process.execPath, ['--test', ...files], { cwd: root, stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
