/**
 * Prices stored in kopiyky (cents). 45000 = 450.00 UAH
 */

export function formatPrice(kopiyky: number): string {
  const hryvni = kopiyky / 100;
  const formatted = hryvni % 1 === 0 ? hryvni.toString() : hryvni.toFixed(2);
  return `${formatted} грн`;
}

export function formatPriceShort(kopiyky: number): string {
  const hryvni = kopiyky / 100;
  return hryvni % 1 === 0 ? `${hryvni}` : hryvni.toFixed(2);
}

export function toKopiyky(hryvni: number): number {
  return Math.round(hryvni * 100);
}

export function toHryvni(kopiyky: number): number {
  return kopiyky / 100;
}
