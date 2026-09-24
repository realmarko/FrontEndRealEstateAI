import { Component, Input } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { TranslationService } from '../../../core/services/translation.service';

// One line under a form control, shown only once the visitor has actually reached/left it
// (touched) and it's still invalid — never on first render, so a required field doesn't start
// the form already covered in red before anyone's typed anything. The message is already a
// translated string by the time the template renders it (see `message` below), so the template
// itself has no i18n dependency of its own.
@Component({
  selector: 'app-form-error',
  standalone: true,
  templateUrl: './form-error.component.html',
  styleUrl: './form-error.component.css'
})
export class FormErrorComponent {
  @Input() control: AbstractControl | null = null;

  constructor(private readonly translation: TranslationService) {}

  get message(): string | null {
    const c = this.control;
    if (!c || c.valid || !(c.touched || c.dirty)) return null;

    if (c.errors?.['required']) return this.translation.t('formErrors.required');
    if (c.errors?.['pattern']) return this.translation.t('formErrors.invalidUrl');
    if (c.errors?.['min']) return this.translation.t('formErrors.min', { min: c.errors['min'].min });
    if (c.errors?.['max']) return this.translation.t('formErrors.max', { max: c.errors['max'].max });
    return this.translation.t('formErrors.invalid');
  }
}
