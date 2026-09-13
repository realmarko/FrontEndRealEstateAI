import { Component, Input, computed, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Currency } from '../../../core/models/listing.model';
import { TranslatePipe } from '../../pipes/translate.pipe';

// Purely a client-side estimator — there's no lender integration behind this, so every
// input is user-editable with a reasonable starting default rather than a "real" rate.
const DEFAULT_DOWN_PAYMENT_PERCENT = 20;
const DEFAULT_INTEREST_RATE_PERCENT = 10.5;
const DEFAULT_TERM_YEARS = 30;

@Component({
  selector: 'app-mortgage-calculator',
  standalone: true,
  imports: [CurrencyPipe, TranslatePipe],
  templateUrl: './mortgage-calculator.component.html',
  styleUrl: './mortgage-calculator.component.css'
})
export class MortgageCalculatorComponent {
  @Input({ required: true }) price!: number;
  @Input() currency: Currency = 'MXN';

  readonly downPaymentPercent = signal(DEFAULT_DOWN_PAYMENT_PERCENT);
  readonly interestRate = signal(DEFAULT_INTEREST_RATE_PERCENT);
  readonly termYears = signal(DEFAULT_TERM_YEARS);

  readonly downPaymentAmount = computed(() => this.price * (this.downPaymentPercent() / 100));

  readonly monthlyPayment = computed(() => {
    const loanAmount = this.price - this.downPaymentAmount();
    const numPayments = this.termYears() * 12;
    if (numPayments <= 0 || loanAmount <= 0) return 0;

    const monthlyRate = this.interestRate() / 100 / 12;
    if (monthlyRate === 0) return loanAmount / numPayments;

    // Standard amortization formula: M = P * [r(1+r)^n] / [(1+r)^n - 1]
    const factor = Math.pow(1 + monthlyRate, numPayments);
    return (loanAmount * (monthlyRate * factor)) / (factor - 1);
  });

  setDownPaymentPercent(value: string): void {
    this.downPaymentPercent.set(Math.max(0, Math.min(100, Number(value) || 0)));
  }

  setInterestRate(value: string): void {
    this.interestRate.set(Math.max(0, Math.min(30, Number(value) || 0)));
  }

  setTermYears(value: string): void {
    this.termYears.set(Number(value));
  }
}
