import { load } from '../app/store';

export type Rule = { readonly name: string; readonly weight: number };

export function weigh(r: Rule): number {
  return r.weight;
}

export function reload(name: string): Rule {
  return load(name);
}
