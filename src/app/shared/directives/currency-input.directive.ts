import { Directive, ElementRef, HostListener, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { applyCurrencyMask, formatCurrencyDisplay } from '../utils/currency-input';

/**
 * Displays a numeric form control as "$1,234,567" while typing, keeping the underlying
 * FormControl value a plain number. Use on a plain text input: [type="text" appCurrencyInput].
 */
@Directive({
  selector: '[appCurrencyInput]',
  standalone: true,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CurrencyInputDirective), multi: true }
  ]
})
export class CurrencyInputDirective implements ControlValueAccessor {
  private onChange: (value: number | null) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private readonly el: ElementRef<HTMLInputElement>) {}

  @HostListener('input', ['$event'])
  onInput(event: Event): void {
    const digits = applyCurrencyMask(event.target as HTMLInputElement);
    this.onChange(digits === '' ? null : Number(digits));
  }

  @HostListener('blur')
  onBlur(): void {
    this.onTouched();
  }

  writeValue(value: number | null): void {
    const digits = value === null || value === undefined ? '' : String(Math.round(value));
    this.el.nativeElement.value = formatCurrencyDisplay(digits);
  }

  registerOnChange(fn: (value: number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.el.nativeElement.disabled = isDisabled;
  }
}
