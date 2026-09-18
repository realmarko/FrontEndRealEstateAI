import { Component, computed, input, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Currency } from '../../../core/models/listing.model';
import { TranslatePipe } from '../../pipes/translate.pipe';
import {
  RoiScenario,
  calculateDevelopSellReturn,
  calculateLandBankingReturn,
  calculateLeaseYield
} from '../../utils/roi';

@Component({
  selector: 'app-roi-calculator',
  standalone: true,
  imports: [CurrencyPipe, DecimalPipe, TranslatePipe],
  templateUrl: './roi-calculator.component.html',
  styleUrl: './roi-calculator.component.css'
})
export class RoiCalculatorComponent {
  readonly landPrice = input.required<number>();
  readonly currency = input<Currency>('MXN');

  readonly scenario = signal<RoiScenario>('lease');

  // Shared between the "lease" and "developSell" scenarios — both mean the same real-world
  // number ("cost to build on this land"), so switching scenarios must not discard it.
  readonly constructionCost = signal(0);
  readonly monthlyRent = signal(0);

  readonly appreciationPercent = signal(5);
  readonly bankingYears = signal(5);

  readonly projectedSalePrice = signal(0);

  readonly leaseResult = computed(() =>
    calculateLeaseYield(this.landPrice(), this.constructionCost(), this.monthlyRent())
  );
  readonly landBankingResult = computed(() =>
    calculateLandBankingReturn(this.landPrice(), this.appreciationPercent(), this.bankingYears())
  );
  readonly developSellResult = computed(() =>
    calculateDevelopSellReturn(this.landPrice(), this.constructionCost(), this.projectedSalePrice())
  );

  setScenario(value: string): void {
    this.scenario.set(value as RoiScenario);
  }

  setConstructionCost(value: string): void {
    this.constructionCost.set(Math.max(0, Number(value) || 0));
  }

  setMonthlyRent(value: string): void {
    this.monthlyRent.set(Math.max(0, Number(value) || 0));
  }

  setAppreciationPercent(value: string): void {
    this.appreciationPercent.set(Number(value) || 0);
  }

  setBankingYears(value: string): void {
    this.bankingYears.set(Math.max(1, Number(value) || 1));
  }

  setProjectedSalePrice(value: string): void {
    this.projectedSalePrice.set(Math.max(0, Number(value) || 0));
  }
}
