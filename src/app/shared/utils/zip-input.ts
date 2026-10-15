// Mexican postal codes are exactly 5 digits (SEPOMEX) — no grouping/formatting needed, unlike
// phone or currency, just a hard digit-only, 5-character cap.
const ZIP_DIGIT_COUNT = 5;

export function digitsFromZipInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, ZIP_DIGIT_COUNT);
}

/**
 * Strips non-digits and caps at 5 characters in place, preserving caret position — same
 * reasoning as applyCurrencyMask/applyPhoneMask: resetting .value on every keystroke would
 * otherwise always snap the caret to the end.
 */
export function applyZipMask(input: HTMLInputElement): string {
  const caretPos = input.selectionStart ?? input.value.length;
  const digitsBeforeCaret = digitsFromZipInput(input.value.slice(0, caretPos)).length;

  const digits = digitsFromZipInput(input.value);
  input.value = digits;
  input.setSelectionRange(digitsBeforeCaret, digitsBeforeCaret);

  return digits;
}
