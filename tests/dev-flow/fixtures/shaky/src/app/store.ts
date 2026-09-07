import { Rule } from '../domain/rule';

export type Raw = string;

export function load(name: string): Rule {
  return { name, weight: 1 };
}

export function score(raw: Raw): number {
  throw new Error('F-001#score not implemented');
}
