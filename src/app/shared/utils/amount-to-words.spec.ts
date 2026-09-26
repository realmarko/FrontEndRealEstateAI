import { amountToWords } from './amount-to-words';

describe('amountToWords', () => {
  it('spells out a whole dollar amount in English', () => {
    expect(amountToWords(1234, 'en', 'USD')).toBe('One thousand two hundred thirty-four dollars and 00/100');
  });

  it('spells out a whole amount in Spanish with pesos', () => {
    expect(amountToWords(1234, 'es', 'MXN')).toBe('Mil doscientos treinta y cuatro pesos con 00/100');
  });

  it('uses the singular noun for an amount of exactly one', () => {
    expect(amountToWords(1, 'en', 'USD')).toBe('One dollar and 00/100');
    expect(amountToWords(1, 'es', 'USD')).toBe('Un dólar con 00/100');
  });

  it('applies the uno/veintiuno apocope in Spanish', () => {
    expect(amountToWords(21, 'es', 'MXN')).toBe('Veintiún pesos con 00/100');
    expect(amountToWords(1000000, 'es', 'MXN')).toBe('Un millón pesos con 00/100');
    expect(amountToWords(21000000, 'es', 'MXN')).toBe('Veintiún millones pesos con 00/100');
  });

  it('includes cents rounded to two digits', () => {
    expect(amountToWords(10.5, 'en', 'USD')).toBe('Ten dollars and 50/100');
    expect(amountToWords(10.006, 'en', 'USD')).toBe('Ten dollars and 01/100');
  });

  it('treats zero as "zero"/"cero"', () => {
    expect(amountToWords(0, 'en', 'USD')).toBe('Zero dollars and 00/100');
    expect(amountToWords(0, 'es', 'MXN')).toBe('Cero pesos con 00/100');
  });

  it('clamps negative or non-finite amounts to zero', () => {
    expect(amountToWords(-500, 'en', 'USD')).toBe('Zero dollars and 00/100');
    expect(amountToWords(NaN, 'en', 'USD')).toBe('Zero dollars and 00/100');
  });

  it('handles millions and thousands combined', () => {
    expect(amountToWords(2_345_678, 'en', 'USD')).toBe(
      'Two million three hundred forty-five thousand six hundred seventy-eight dollars and 00/100'
    );
  });
});
