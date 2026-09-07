export type TokenId = string;
export type TokenPair = { access: string; refresh: string };

export function rotate(id: TokenId): TokenPair {
  return { access: id + 'a', refresh: id + 'r' };
}

export function verify(id: TokenId): boolean {
  return id.length > 0;
}
