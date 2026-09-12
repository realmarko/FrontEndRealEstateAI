import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';
import { Lang, TranslationService } from '../../../core/services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslatePipe],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent {
  readonly isMenuOpen = signal(false);

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    protected readonly auth: AuthService,
    protected readonly translation: TranslationService,
    private readonly router: Router
  ) {
    // Collapse the mobile menu automatically once a link inside it is followed. This component
    // is a root-level singleton (rendered once outside <router-outlet>) so this subscription
    // already lives for the whole app session either way — takeUntilDestroyed is just defensive
    // in case that ever changes.
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.isMenuOpen.set(false);
      });
  }

  toggleMenu(): void {
    this.isMenuOpen.update((open) => !open);
  }

  logout(): void {
    this.auth.logout();
    this.isMenuOpen.set(false);
    this.router.navigate(['/login']);
  }

  setLang(lang: Lang): void {
    this.translation.setLang(lang);
  }
}
