import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const cache = new Map();
export async function moduleUrl(path) {
  const key = String(path);
  if (cache.has(key)) return cache.get(key);
  let code = ts.transpileModule(await readFile(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const match of [...code.matchAll(/from\s+(["'])([^"']+)\1/g)]) {
    const spec = match[2];
    const url = spec.startsWith('.') ? await moduleUrl(new URL(spec + '.ts', path)) : import.meta.resolve(spec);
    code = code.replace(match[0], `from ${JSON.stringify(url)}`);
  }
  const url = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  cache.set(key, url);
  return url;
}
export async function loadTs(relative) { return import(await moduleUrl(new URL(relative, import.meta.url))); }
