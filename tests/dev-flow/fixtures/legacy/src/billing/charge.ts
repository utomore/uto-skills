export type Cents = number;

export function charge(amount: Cents): boolean {
  return amount >= 0;
}

export function rotate(id: string): string {
  return id;
}
