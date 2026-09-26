import { applyCurrencyMask, digitsFromInput, formatCurrencyDisplay } from './currency-input';

describe('digitsFromInput', () => {
  it('strips non-digit characters', () => {
    expect(digitsFromInput('$1,234')).toBe('1234');
  });

  it('drops anything after a decimal point', () => {
    expect(digitsFromInput('1234.56')).toBe('1234');
  });

  it('returns an empty string when there are no digits', () => {
    expect(digitsFromInput('abc')).toBe('');
  });
});

describe('formatCurrencyDisplay', () => {
  it('formats digits with thousands separators and a dollar sign', () => {
    expect(formatCurrencyDisplay('1234567')).toBe('$1,234,567');
  });

  it('returns an empty string for empty input', () => {
    expect(formatCurrencyDisplay('')).toBe('');
  });
});

describe('applyCurrencyMask', () => {
  function makeInput(value: string, caretPos: number): HTMLInputElement {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.value = value;
    input.setSelectionRange(caretPos, caretPos);
    return input;
  }

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('reformats the input value and returns the extracted digits', () => {
    const input = makeInput('1234', 4);
    const digits = applyCurrencyMask(input);
    expect(digits).toBe('1234');
    expect(input.value).toBe('$1,234');
  });

  it('keeps the caret aligned with the digit typed, not the end of the field', () => {
    // "$1,234" with caret right after "1,2" (5 digits typed: 1,2 then insert nothing) -
    // simulate typing "3" in the middle of "12|34" -> "1234"
    const input = makeInput('12334', 3);
    const digits = applyCurrencyMask(input);
    expect(digits).toBe('12334');
    expect(input.value).toBe('$12,334');
    // 3 digits were before the caret ("123"), so caret should land after the 3rd digit in the
    // reformatted value: "$12,3|34" -> index 5
    expect(input.selectionStart).toBe(5);
  });
});
