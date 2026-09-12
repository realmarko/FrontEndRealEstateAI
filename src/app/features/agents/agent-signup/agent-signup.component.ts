import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AgentService } from '../../../core/services/agent.service';
import { AuthService } from '../../../core/services/auth.service';
import { TranslationService } from '../../../core/services/translation.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-agent-signup',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './agent-signup.component.html',
  styleUrl: './agent-signup.component.css'
})
export class AgentSignupComponent {
  private readonly fb = inject(FormBuilder);
  private readonly agentService = inject(AgentService);
  private readonly router = inject(Router);
  private readonly translation = inject(TranslationService);
  protected readonly auth = inject(AuthService);

  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    phone: ['', [Validators.required, Validators.minLength(7)]]
  });

  constructor() {
    if (!this.auth.currentUser()?.roles.includes('Agent')) {
      this.router.navigate(['/listings']);
    }
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.agentService.createMine(this.form.getRawValue().phone).subscribe({
      next: () => this.router.navigate(['/agents']),
      error: () => this.errorMessage.set(this.translation.t('agentSignup.submitError'))
    });
  }
}
