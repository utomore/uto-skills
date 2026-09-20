export type Title = { readonly text: string };

export function normalize(raw: string): Title {
  return { text: raw.trim().replace(/\s+/g, ' ') };
}

export function titleText(t: Title): string {
  return t.text;
}
