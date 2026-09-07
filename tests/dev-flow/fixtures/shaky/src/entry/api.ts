import fs from 'node:fs';
import { score } from '../app/store';
import { Raw } from '../app/store';

export function scoreHandler(raw: Raw): number {
  return score(raw);
}

export function dumpHandler(raw: Raw): string {
  fs.writeFileSync('/tmp/x', raw);
  return 'ok';
}
