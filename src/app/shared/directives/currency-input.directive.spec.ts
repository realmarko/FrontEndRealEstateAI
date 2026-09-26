import { Component } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { CurrencyInputDirective } from './currency-input.directive';

@Component({
  standalone: true,
  imports: [FormsModule, CurrencyInputDirective],
  template: `<input type="text" appCurrencyInput [(ngModel)]="amount" />`
})
class HostComponent {
  amount: number | null = null;
}

describe('CurrencyInputDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let inputEl: HTMLInputElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    inputEl = fixture.debugElement.query(By.css('input')).nativeElement;
  });

  it('formats the initial model value as currency', fakeAsync(() => {
    fixture.componentInstance.amount = 1234567;
    fixture.detectChanges();
    tick();
    expect(inputEl.value).toBe('$1,234,567');
  }));

  it('shows an empty string when the model value is null', fakeAsync(() => {
    fixture.componentInstance.amount = null;
    fixture.detectChanges();
    tick();
    expect(inputEl.value).toBe('');
  }));

  it('masks input as the user types and updates the bound number', () => {
    inputEl.value = '250000';
    inputEl.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(inputEl.value).toBe('$250,000');
    expect(fixture.componentInstance.amount).toBe(250000);
  });

  it('sets the model to null when all digits are removed', () => {
    inputEl.value = '';
    inputEl.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.componentInstance.amount).toBeNull();
  });

  it('disables the input when the control is disabled', () => {
    const directive = fixture.debugElement
      .query(By.css('input'))
      .injector.get(CurrencyInputDirective);
    directive.setDisabledState(true);
    expect(inputEl.disabled).toBeTrue();
  });
});
