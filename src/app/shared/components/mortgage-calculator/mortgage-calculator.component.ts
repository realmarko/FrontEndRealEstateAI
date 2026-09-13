import { Component, computed, input, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Currency } from '../../../core/models/listing.model';
import { TranslatePipe } from '../../pipes/translate.pipe';
import {
  DEFAULT_DOWN_PAYMENT_PERCENT,
  DEFAULT_INTEREST_RATE_PERCENT,
  DEFAULT_TERM_YEARS,
  calculateMonthlyPayment
} from '../../utils/mortgage';

@Component({
  selector: 'app-mortgage-calculator',
  standalone: true,
  imports: [CurrencyPipe, TranslatePipe],
  templateUrl: './mortgage-calculator.component.html',
  styleUrl: './mortgage-calculator.component.css'
})
export class MortgageCalculatorComponent {
  // Signal inputs, not @Input(): `computed()` only re-runs when a signal it read changes,
  // and a plain @Input property is invisible to that tracking — price needs to update live
  // as the listing form's price field changes, not just once at first render.
  readonly price = input.required<number>();
  readonly currency = input<Currency>('MXN');

  readonly downPaymentPercent = signal(DEFAULT_DOWN_PAYMENT_PERCENT);
  readonly interestRate = signal(DEFAULT_INTEREST_RATE_PERCENT);
  readonly termYears = signal(DEFAULT_TERM_YEARS);

  readonly downPaymentAmount = computed(() => this.price() * (this.downPaymentPercent() / 100));

  readonly monthlyPayment = computed(() =>
    calculateMonthlyPayment(this.price(), this.downPaymentPercent(), this.interestRate(), this.termYears())
  );

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
