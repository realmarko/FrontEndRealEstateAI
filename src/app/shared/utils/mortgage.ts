// Shared with MortgageCalculatorComponent and anywhere else that needs a quick payment
// estimate (e.g. listing cards) — keeps the amortization math in one place.
export const DEFAULT_DOWN_PAYMENT_PERCENT = 20;
export const DEFAULT_INTEREST_RATE_PERCENT = 10.5;
export const DEFAULT_TERM_YEARS = 30;

// Standard amortization formula: M = P * [r(1+r)^n] / [(1+r)^n - 1]
export function calculateMonthlyPayment(
  price: number,
  downPaymentPercent: number,
  interestRatePercent: number,
  termYears: number
): number {
  const loanAmount = price - price * (downPaymentPercent / 100);
  const numPayments = termYears * 12;
  if (numPayments <= 0 || loanAmount <= 0) return 0;

  const monthlyRate = interestRatePercent / 100 / 12;
  if (monthlyRate === 0) return loanAmount / numPayments;

  const factor = Math.pow(1 + monthlyRate, numPayments);
  return (loanAmount * (monthlyRate * factor)) / (factor - 1);
}
