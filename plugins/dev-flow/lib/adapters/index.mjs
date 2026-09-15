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

// [{dir, name}] → [{dir, name, adapter}];哪一個目錄沒有 adapter 就回 null 讓呼叫端講
export function pickSides(languages) {
  return languages.map((l) => ({ ...l, adapter: pickAdapter(l.name) }));
}
