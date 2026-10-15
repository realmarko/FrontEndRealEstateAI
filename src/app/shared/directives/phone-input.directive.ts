import { Directive, ElementRef, HostListener, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { applyPhoneMask, digitsFromPhoneInput, formatPhoneDisplay } from '../utils/phone-input';

/**
 * Displays a phone FormControl as "222 555 0101" while typing, keeping the underlying value a
 * plain 10-digit string (e.g. "2225550101") — same ControlValueAccessor + caret-preserving
 * reformat approach as CurrencyInputDirective. Use on a plain text input:
 * [type="tel" appPhoneInput].
 */
@Directive({
  selector: '[appPhoneInput]',
  standalone: true,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => PhoneInputDirective), multi: true }
  ]
})
export class PhoneInputDirective implements ControlValueAccessor {
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private readonly el: ElementRef<HTMLInputElement>) {}

  @HostListener('input', ['$event'])
  onInput(event: Event): void {
    const digits = applyPhoneMask(event.target as HTMLInputElement);
    this.onChange(digits);
  }

  @HostListener('blur')
  onBlur(): void {
    this.onTouched();
  }

  writeValue(value: string | null): void {
    // Runs existing values through the same digit extraction as live typing — a pre-existing
    // record saved before this mask existed (dashes, spaces, or an off-length number; see the
    // forms audit that prompted this directive) still needs to display cleanly rather than
    // garble formatPhoneDisplay's fixed slice offsets, which assume digits-only input.
    this.el.nativeElement.value = formatPhoneDisplay(digitsFromPhoneInput(value ?? ''));
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
