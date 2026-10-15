import { Directive, ElementRef, HostListener, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { applyZipMask, digitsFromZipInput } from '../utils/zip-input';

/**
 * Restricts a zip-code FormControl to digits only, capped at 5 characters, while typing — same
 * ControlValueAccessor approach as CurrencyInputDirective/PhoneInputDirective, minus any display
 * reformatting (a Mexican postal code has no grouping, unlike a phone number or a peso amount).
 * Use on a plain text input: [type="text" appZipInput].
 */
@Directive({
  selector: '[appZipInput]',
  standalone: true,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => ZipInputDirective), multi: true }
  ]
})
export class ZipInputDirective implements ControlValueAccessor {
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private readonly el: ElementRef<HTMLInputElement>) {}

  @HostListener('input', ['$event'])
  onInput(event: Event): void {
    const digits = applyZipMask(event.target as HTMLInputElement);
    this.onChange(digits);
  }

  @HostListener('blur')
  onBlur(): void {
    this.onTouched();
  }

  writeValue(value: string | null): void {
    this.el.nativeElement.value = digitsFromZipInput(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.el.nativeElement.disabled = isDisabled;
  }
}
