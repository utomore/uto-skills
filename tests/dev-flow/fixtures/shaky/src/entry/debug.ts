import fs from 'node:fs';

export function dumpAll(path: string): string {
  return fs.readFileSync(path, 'utf8');
}
