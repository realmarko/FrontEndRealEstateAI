// Land-banking/lease/develop-sell ROI math for land & commercial listings. Pure functions,
// no Angular dependency — see MortgageCalculatorComponent/mortgage.ts for the identical
// calc-utility + standalone-component split this follows. All inputs here are the viewer's
// own live assumptions applied to the already-published listing price — never persisted,
// never sent to the backend.

export type RoiScenario = 'lease' | 'landBanking' | 'developSell';

export interface LeaseYieldResult {
  annualRent: number;
  totalInvestment: number;
  annualYieldPercent: number;
  paybackYears: number | null; // null when annualRent <= 0 (never pays back)
}

// Scenario A: lease to a retail chain. ROI = annualized rent / total investment (land + construction).
export function calculateLeaseYield(landPrice: number, constructionCost: number, monthlyRent: number): LeaseYieldResult {
  const totalInvestment = landPrice + constructionCost;
  const annualRent = monthlyRent * 12;
  const annualYieldPercent = totalInvestment > 0 ? (annualRent / totalInvestment) * 100 : 0;
  const paybackYears = annualRent > 0 ? totalInvestment / annualRent : null;
  return { annualRent, totalInvestment, annualYieldPercent, paybackYears };
}

export interface LandBankingResult {
  projectedValue: number;
  totalGain: number;
  totalGainPercent: number;
  annualizedGainPercent: number;
}

// Scenario B: land banking / appreciation only — no construction, projected value growth over N years.
export function calculateLandBankingReturn(landPrice: number, annualAppreciationPercent: number, years: number): LandBankingResult {
  const projectedValue = landPrice * Math.pow(1 + annualAppreciationPercent / 100, years);
  const totalGain = projectedValue - landPrice;
  const totalGainPercent = landPrice > 0 ? (totalGain / landPrice) * 100 : 0;
  return { projectedValue, totalGain, totalGainPercent, annualizedGainPercent: annualAppreciationPercent };
}

export interface DevelopSellResult {
  totalInvestment: number;
  projectedProfit: number;
  roiPercent: number;
}

// Scenario C: buy-develop-sell — projected sale price minus total investment (land + construction).
export function calculateDevelopSellReturn(landPrice: number, constructionCost: number, projectedSalePrice: number): DevelopSellResult {
  const totalInvestment = landPrice + constructionCost;
  const projectedProfit = projectedSalePrice - totalInvestment;
  const roiPercent = totalInvestment > 0 ? (projectedProfit / totalInvestment) * 100 : 0;
  return { totalInvestment, projectedProfit, roiPercent };
}
