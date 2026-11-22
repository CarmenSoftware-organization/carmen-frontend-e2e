/**
 * Money oracle for the AP + JV specs. Expected amounts come from here, never from the backend's echo.
 *
 * Rounding is HALF_UP at the BU's decimals (accounting-foundation.md:103) - ties go away from zero.
 * Every figure is worked in integer minor units so 1.005 / 0.285 style values do not drift.
 *
 * assumption: VAT 7% and WHT apply to the pre-VAT line base; WHT is computed at payment, not at invoice.
 * assumption: an Inc-VAT line backs the pre-VAT base out of the gross, then VAT = gross - base.
 */

/** Scale `n` to integer minor units without binary-float drift (15 significant digits is the safe limit). */
function toMinor(n: number, decimals: number): number {
  return Number((n * 10 ** decimals).toPrecision(15));
}

/** Half-up (ties away from zero) to `decimals` places. */
export function round(n: number, decimals: number): number {
  const scaled = toMinor(Math.abs(n), decimals);
  const up = Math.floor(scaled + 0.5);
  return (Math.sign(n) * up) / 10 ** decimals || 0;
}

/** VAT on a pre-VAT net: `net x rate%`, rounded half-up. */
export const vatOf = (net: number, rate: number, decimals: number): number => round((net * rate) / 100, decimals);

/** Pre-VAT base of a VAT-inclusive gross: `gross / (1 + rate%)`, rounded half-up. */
export const netFromIncVat = (gross: number, rate: number, decimals: number): number =>
  round((gross * 100) / (100 + rate), decimals);

/** Withholding tax on a pre-VAT base: `base x rate%`, rounded half-up. */
export const whtOf = (base: number, rate: number, decimals: number): number => round((base * rate) / 100, decimals);

export interface MoneyLine {
  qty: number;
  price: number;
  /** Carries VAT. Default true (the seeded "Vat 7%" profile). */
  vat?: boolean;
  /** The price already contains VAT. */
  incVat?: boolean;
}

export interface LineAmounts {
  net: number;
  vat: number;
  total: number;
}

/** One invoice line on the BU rule: subtotal rounded, VAT per line rounded, Inc-VAT carved out of the gross. */
export function lineAmounts(l: MoneyLine, rate = 7, decimals = 2): LineAmounts {
  const gross = round(l.qty * l.price, decimals);
  if (l.vat === false) return { net: gross, vat: 0, total: gross };
  if (l.incVat) {
    const net = netFromIncVat(gross, rate, decimals);
    return { net, vat: round(gross - net, decimals), total: gross };
  }
  const vat = vatOf(gross, rate, decimals);
  return { net: gross, vat, total: round(gross + vat, decimals) };
}

/** Document totals = sum of the rounded lines (never rounded again). */
export function docAmounts(lines: MoneyLine[], rate = 7, decimals = 2): LineAmounts {
  const parts = lines.map((l) => lineAmounts(l, rate, decimals));
  const sum = (k: keyof LineAmounts) => round(parts.reduce((s, p) => s + p[k], 0), decimals);
  return { net: sum("net"), vat: sum("vat"), total: sum("total") };
}

/** Throws unless total debit equals total credit (compared to 1/10000, so 0.01 off always fails). */
export function expectBalanced(lines: { dr: number; cr: number }[]): void {
  const dr = lines.reduce((s, l) => s + Math.round(l.dr * 10_000), 0);
  const cr = lines.reduce((s, l) => s + Math.round(l.cr * 10_000), 0);
  if (dr !== cr) throw new Error(`journal not balanced: Dr ${dr / 10_000} != Cr ${cr / 10_000}`);
}
