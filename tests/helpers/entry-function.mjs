import { readFileSync } from 'node:fs';
import { parse } from 'acorn';

export function entryFunction(file, name, dependencies) {
  const source = readFileSync(new URL('../../src/' + file, import.meta.url), 'utf8');
  const ast = parse(source, { sourceType: 'module', ecmaVersion: 'latest' });
  const declaration = ast.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === name);
  if (!declaration) throw new Error(`Missing ${name}`);
  const code = source.slice(declaration.start, declaration.end);
  return new Function(...Object.keys(dependencies), `${code}; return ${name};`)(...Object.values(dependencies));
}
