import { Component, DestroyRef, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Lang, TranslationService } from '../../../core/services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { UserRole } from '../../../core/models/user.model';

// Roles worth offering as a self-service upgrade — "Buyer" isn't here because it unlocks
// nothing an authenticated visitor doesn't already have (browsing/favoriting/messaging), and
// "Admin" is never self-granted.
const ADDABLE_ROLES: UserRole[] = ['Owner', 'Agent'];

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslatePipe],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent {
  readonly isMenuOpen = signal(false);
  readonly isAccountMenuOpen = signal(false);
  readonly addingRole = signal(false);

  // Only the roles the visitor doesn't already hold — the dropdown simply doesn't render once
  // this is empty (e.g. already Agent, which already implies Owner): there's nothing left to
  // upgrade to, so showing a picker with no real choices left would be pointless.
  readonly addableRoles = computed(() => {
    const current = this.auth.currentUser()?.roles ?? [];
    return ADDABLE_ROLES.filter((role) => !current.includes(role));
  });

  // The one role label shown next to the name — Agent implies Owner already, so Agent wins when
  // both are present; falls back to Buyer when neither upgrade has been taken yet.
  readonly currentRoleLabel = computed(() => {
    const roles = this.auth.currentUser()?.roles ?? [];
    if (roles.includes('Agent')) return 'nav.becomeAgent';
    if (roles.includes('Owner')) return 'nav.becomeOwner';
    return 'nav.roleBuyer';
  });

  // The language the toggle button switches TO, not the current one — the button reads "English"
  // while browsing in Spanish, and vice versa, same convention every bilingual site uses.
  readonly otherLang = computed<Lang>(() => (this.translation.lang() === 'es' ? 'en' : 'es'));

  private readonly destroyRef = inject(DestroyRef);
  private readonly notification = inject(NotificationService);
  private readonly elementRef = inject(ElementRef<HTMLElement>);

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
        this.isAccountMenuOpen.set(false);
      });
  }

  // Closes the account dropdown on any click outside it — without this it would only close via
  // its own trigger, which isn't how every other dropdown on the web behaves and trips people up.
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isAccountMenuOpen() && !this.elementRef.nativeElement.contains(event.target as Node)) {
      this.isAccountMenuOpen.set(false);
    }
  }

  toggleMenu(): void {
    this.isMenuOpen.update((open) => !open);
  }

  toggleAccountMenu(): void {
    this.isAccountMenuOpen.update((open) => !open);
  }

  logout(): void {
    this.auth.logout();
    this.isMenuOpen.set(false);
    this.isAccountMenuOpen.set(false);
    this.router.navigate(['/login']);
  }

  setLang(lang: Lang): void {
    this.translation.setLang(lang);
  }

  // No role param reset needed anymore (addRole is a direct button click, not a <select> that
  // needs its displayed value reverted) — the panel just closes, same as any other menu action.
  addRole(role: UserRole): void {
    if (this.addingRole()) return;

    this.addingRole.set(true);
    this.auth.addRole(role).subscribe({
      next: () => {
        this.addingRole.set(false);
        this.notification.success('nav.roleAddedSuccess');
        this.isMenuOpen.set(false);
        this.isAccountMenuOpen.set(false);
        if (role === 'Agent') {
          this.router.navigate(['/agents/new']);
        }
      },
      error: () => {
        this.addingRole.set(false);
        this.notification.error('nav.roleAddedError');
      }
    });
  }
}
