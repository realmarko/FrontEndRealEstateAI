import { calculateMonthlyPayment } from './mortgage';

describe('calculateMonthlyPayment', () => {
  it('computes the standard amortized monthly payment', () => {
    const payment = calculateMonthlyPayment(200000, 20, 6, 30);
    // loan = 160000, 6%/12 = 0.5% monthly, 360 payments -> ~959.28
    expect(payment).toBeCloseTo(959.28, 1);
  });

  it('returns 0 when the term is zero or negative', () => {
    expect(calculateMonthlyPayment(200000, 20, 6, 0)).toBe(0);
    expect(calculateMonthlyPayment(200000, 20, 6, -5)).toBe(0);
  });

  it('returns 0 when the down payment covers the full price', () => {
    expect(calculateMonthlyPayment(200000, 100, 6, 30)).toBe(0);
  });

  it('divides the loan evenly across payments when the interest rate is zero', () => {
    const payment = calculateMonthlyPayment(120000, 0, 0, 10);
    expect(payment).toBeCloseTo(120000 / 120, 5);
  });

  it('treats a down payment over 100% as producing no loan amount', () => {
    expect(calculateMonthlyPayment(200000, 150, 6, 30)).toBe(0);
  });
});
