import { AbstractControl, ValidationErrors } from '@angular/forms';

// Mirrors ASP.NET Core Identity's default password policy (Program.cs only overrides
// RequiredLength; RequireUppercase/RequireLowercase/RequireDigit/RequireNonAlphanumeric all stay
// at their built-in defaults of true) — enforcing the same rules client-side means a weak
// password gets caught here instead of surfacing as AuthController.Register's generic
// "registration failed" error only after a round trip.
export function passwordStrengthValidator(control: AbstractControl): ValidationErrors | null {
  const value: string = control.value ?? '';
  if (!value) return null; // required validator's job, not this one's

  const errors: Record<string, boolean> = {};
  if (!/[A-Z]/.test(value)) errors['missingUppercase'] = true;
  if (!/[a-z]/.test(value)) errors['missingLowercase'] = true;
  if (!/[0-9]/.test(value)) errors['missingDigit'] = true;
  if (!/[^A-Za-z0-9]/.test(value)) errors['missingSpecialChar'] = true;

  return Object.keys(errors).length > 0 ? { passwordStrength: errors } : null;
}
