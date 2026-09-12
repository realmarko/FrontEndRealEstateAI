/** Keeps digits only — strips everything else a user might type or paste. */
export function digitsFromInput(value: string): string {
  return value.replace(/[^\d]/g, '');
}

/** Formats a run of digits as "$1,234,567" (whole-dollar amounts, no decimals). */
export function formatCurrencyDisplay(digits: string): string {
  if (!digits) return '';
  return '$' + Number(digits).toLocaleString('en-US');
}
