// Mexican phone numbers are 10 digits (area code + local number), no leading 1/0 — matches
// every real example seen in this app (e.g. "222 555 0101") and the exact assumption
// WhatsAppButtonComponent's toWhatsAppNumber already makes when prepending the 52 country code.
// Capping input at 10 digits here is what actually fixes the inconsistent-length data
// (9/10/11-digit phones) found in an audit of this app's forms — not just a display nicety.
const PHONE_DIGIT_COUNT = 10;

/** Strips everything but digits, then caps at the 10 digits a Mexican phone number holds. */
export function digitsFromPhoneInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, PHONE_DIGIT_COUNT);
}

/** Formats a run of up to 10 digits as "222 555 0101" (3-3-4 grouping), partial while typing. */
export function formatPhoneDisplay(digits: string): string {
  const groups = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 10)].filter(Boolean);
  return groups.join(' ');
}

/**
 * Reformats an <input> in place as the user types, preserving the caret position relative to
 * the digits around it — same reasoning as applyCurrencyMask: resetting .value on every
 * keystroke would otherwise always snap the caret to the end. Returns the extracted digits so
 * the caller can update its bound value.
 */
export function applyPhoneMask(input: HTMLInputElement): string {
  const caretPos = input.selectionStart ?? input.value.length;
  const digitsBeforeCaret = digitsFromPhoneInput(input.value.slice(0, caretPos)).length;

  const digits = digitsFromPhoneInput(input.value);
  input.value = formatPhoneDisplay(digits);

  let caret = 0;
  let digitsSeen = 0;
  while (caret < input.value.length && digitsSeen < digitsBeforeCaret) {
    if (/\d/.test(input.value[caret])) digitsSeen++;
    caret++;
  }
  input.setSelectionRange(caret, caret);

  return digits;
}
