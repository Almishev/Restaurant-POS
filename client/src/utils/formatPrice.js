/** ISO currency code for the POS (Bulgaria uses EUR). */
export const CURRENCY = "EUR";
export const CURRENCY_SUFFIX = "€";

/** Format money for display: 9.9 → "9.90 €" */
export const formatPrice = (value) => {
  const n = Number(value);
  if (Number.isNaN(n)) return `0.00 ${CURRENCY_SUFFIX}`;
  return `${n.toFixed(2)} ${CURRENCY_SUFFIX}`;
};

/** Amount only (2 decimals), without currency symbol */
export const formatAmount = (value) => {
  const n = Number(value);
  if (Number.isNaN(n)) return "0.00";
  return n.toFixed(2);
};

/** Round to 2 decimals before save */
export const roundPrice = (value) => {
  const n = Number(value);
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 100) / 100;
};
