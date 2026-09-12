/**
 * Keeps digits only, from the whole-dollar part of the input — strips everything else a
 * user might type or paste. Prices are whole-dollar amounts, so anything after a decimal
 * point is dropped rather than concatenated (which would silently inflate the value).
 */
export function digitsFromInput(value: string): string {
  const [wholePart] = value.split('.');
  return wholePart.replace(/[^\d]/g, '');
}

/** Formats a run of digits as "$1,234,567" (whole-dollar amounts, no decimals). */
export function formatCurrencyDisplay(digits: string): string {
  if (!digits) return '';
  return '$' + Number(digits).toLocaleString('en-US');
}

/**
 * Reformats an <input> in place as the user types, preserving the caret position relative
 * to the digits around it — otherwise resetting .value on every keystroke would always
 * snap the caret to the end, making it impossible to edit anywhere but the end of the field.
 * Returns the extracted digits so the caller can update its bound value.
 */
export function applyCurrencyMask(input: HTMLInputElement): string {
  const caretPos = input.selectionStart ?? input.value.length;
  const digitsBeforeCaret = digitsFromInput(input.value.slice(0, caretPos)).length;

  const digits = digitsFromInput(input.value);
  input.value = formatCurrencyDisplay(digits);

  let caret = 0;
  let digitsSeen = 0;
  while (caret < input.value.length && digitsSeen < digitsBeforeCaret) {
    if (/\d/.test(input.value[caret])) digitsSeen++;
    caret++;
  }
  input.setSelectionRange(caret, caret);

  return digits;
}
