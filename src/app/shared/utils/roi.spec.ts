import {
  calculateDevelopSellReturn,
  calculateLandBankingReturn,
  calculateLeaseYield
} from './roi';

describe('calculateLeaseYield', () => {
  it('computes annualized yield and payback period', () => {
    const result = calculateLeaseYield(100000, 50000, 2000);
    expect(result.totalInvestment).toBe(150000);
    expect(result.annualRent).toBe(24000);
    expect(result.annualYieldPercent).toBeCloseTo(16, 5);
    expect(result.paybackYears).toBeCloseTo(6.25, 5);
  });

  it('returns null payback when there is no rent', () => {
    const result = calculateLeaseYield(100000, 50000, 0);
    expect(result.paybackYears).toBeNull();
    expect(result.annualYieldPercent).toBe(0);
  });

  it('returns a 0 yield when there is no investment', () => {
    const result = calculateLeaseYield(0, 0, 1000);
    expect(result.annualYieldPercent).toBe(0);
  });
});

describe('calculateLandBankingReturn', () => {
  it('compounds appreciation over the given years', () => {
    const result = calculateLandBankingReturn(100000, 10, 2);
    expect(result.projectedValue).toBeCloseTo(121000, 5);
    expect(result.totalGain).toBeCloseTo(21000, 5);
    expect(result.totalGainPercent).toBeCloseTo(21, 5);
    expect(result.annualizedGainPercent).toBe(10);
  });

  it('returns a 0 gain percent when the land price is 0', () => {
    const result = calculateLandBankingReturn(0, 10, 2);
    expect(result.totalGainPercent).toBe(0);
  });

  it('returns the original price when years is 0', () => {
    const result = calculateLandBankingReturn(100000, 10, 0);
    expect(result.projectedValue).toBeCloseTo(100000, 5);
    expect(result.totalGain).toBeCloseTo(0, 5);
  });
});

describe('calculateDevelopSellReturn', () => {
  it('computes profit and roi from sale price minus investment', () => {
    const result = calculateDevelopSellReturn(100000, 50000, 200000);
    expect(result.totalInvestment).toBe(150000);
    expect(result.projectedProfit).toBe(50000);
    expect(result.roiPercent).toBeCloseTo(33.3333, 3);
  });

  it('reports a negative roi when the sale price is below investment', () => {
    const result = calculateDevelopSellReturn(100000, 50000, 100000);
    expect(result.projectedProfit).toBe(-50000);
    expect(result.roiPercent).toBeCloseTo(-33.3333, 3);
  });

  it('returns a 0 roi when there is no investment', () => {
    const result = calculateDevelopSellReturn(0, 0, 10000);
    expect(result.roiPercent).toBe(0);
  });
});
