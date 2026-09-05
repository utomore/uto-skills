import { haskell } from './haskell.mjs';

const ADAPTERS = { haskell };

export function pickAdapter(language) {
  if (!language) return null;
  return ADAPTERS[String(language).toLowerCase()] || null;
}

export const adapterNames = Object.keys(ADAPTERS);
