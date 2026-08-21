import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url));

const FORBIDDEN_PATTERN = /!\s*important\b/gi;

const FALLBACK_EXCLUDED_DIRECTORIES = new Set([
  '.git',
  '.netlify',
  'node_modules',
  'coverage'
]);

const FALLBACK_BINARY_EXTENSIONS = new Set([
  '.avif',
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.pdf',
  '.png',
  '.webp',
  '.woff',
  '.woff2'
]);

function listRepositoryFiles() {
  try {
    const output = execFileSync(
      'git',
      [
        'ls-files',
        '--cached',
        '--others',
        '--exclude-standard',
        '-z'
      ],
      {
        cwd: PROJECT_ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      }
    );

    return output
      .split('\0')
      .filter(Boolean);
  } catch {
    return listFilesFallback(PROJECT_ROOT);
  }
}

function listFilesFallback(directory, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (
      entry.isDirectory() &&
      FALLBACK_EXCLUDED_DIRECTORIES.has(entry.name)
    ) {
      continue;
    }

    const absolutePath = join(directory, entry.name);

    if (entry.isDirectory()) {
      listFilesFallback(absolutePath, files);
      continue;
    }

    if (
      FALLBACK_BINARY_EXTENSIONS.has(
        extname(entry.name).toLowerCase()
      )
    ) {
      continue;
    }

    files.push(
      relative(PROJECT_ROOT, absolutePath)
        .replaceAll('\\', '/')
    );
  }

  return files;
}

function isBinary(buffer) {
  const inspectedLength = Math.min(buffer.length, 8192);

  for (let index = 0; index < inspectedLength; index += 1) {
    if (buffer[index] === 0) {
      return true;
    }
  }

  return false;
}

function findForbiddenDeclarations(filePath) {
  const absolutePath = join(PROJECT_ROOT, filePath);
  const buffer = readFileSync(absolutePath);

  if (isBinary(buffer)) {
    return [];
  }

  const source = buffer.toString('utf8');
  const findings = [];

  FORBIDDEN_PATTERN.lastIndex = 0;

  for (
    let match = FORBIDDEN_PATTERN.exec(source);
    match;
    match = FORBIDDEN_PATTERN.exec(source)
  ) {
    const beforeMatch = source.slice(0, match.index);
    const line = beforeMatch.split(/\r?\n/).length;
    const lastNewline = beforeMatch.lastIndexOf('\n');
    const column = match.index - lastNewline;

    findings.push({
      filePath,
      line,
      column
    });
  }

  return findings;
}

test(
  'priority guard recognizes forced CSS priority syntax',
  () => {
    const sample =
      ['!', 'IMPORTANT'].join('');

    assert.match(
      sample,
      FORBIDDEN_PATTERN
    );
  }
);

test(
  'repository contains no forced CSS priority declarations',
  () => {
    const files = listRepositoryFiles();

    assert.ok(
      files.length > 0,
      'Repository guard did not discover any files.'
    );

    const findings = files.flatMap(
      findForbiddenDeclarations
    );

    assert.deepEqual(
      findings,
      [],
      findings.length > 0
        ? [
            'Forced CSS priority declarations are forbidden:',
            ...findings.map(
              ({ filePath, line, column }) =>
                `  ${filePath}:${line}:${column}`
            )
          ].join('\n')
        : undefined
    );
  }
);
