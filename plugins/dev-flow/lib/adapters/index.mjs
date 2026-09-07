import { typescript } from './typescript.mjs';
import { python } from './python.mjs';
import { go } from './go.mjs';
import { rust } from './rust.mjs';

const ADAPTERS = { typescript, javascript: typescript, python, go, rust };

export function pickAdapter(language) {
  if (!language) return null;
  return ADAPTERS[String(language).toLowerCase()] || null;
}

export const adapterNames = [...new Set(Object.keys(ADAPTERS))];
