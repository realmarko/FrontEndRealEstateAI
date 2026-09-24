import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AuthCredentials, RegisterDetails, User, UserRole } from '../models/user.model';

const TOKEN_KEY = 'reapp_token';
const USER_KEY = 'reapp_user';

interface UserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
}

interface AuthResponseDto {
  token: string;
  expiresAt: string;
  user: UserDto;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/auth`;

  private readonly currentUserSignal = signal<User | null>(this.restoreUser());

  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUserSignal() !== null);

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  register(details: RegisterDetails): Observable<User> {
    return this.http
      .post<AuthResponseDto>(`${this.apiUrl}/register`, {
        firstName: details.firstName,
        lastName: details.lastName,
        email: details.email,
        password: details.password,
        role: details.role
      })
      .pipe(
        tap((res) => this.startSession(res)),
        map((res) => this.toUser(res.user))
      );
  }

  login(credentials: AuthCredentials): Observable<User> {
    return this.http.post<AuthResponseDto>(`${this.apiUrl}/login`, credentials).pipe(
      tap((res) => this.startSession(res)),
      map((res) => this.toUser(res.user))
    );
  }

  // Always resolves — the backend returns 204 whether or not the email is registered, so this
  // can't be used to enumerate accounts. Callers should always show the same generic message.
  forgotPassword(email: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/forgot-password`, { email });
  }

  resetPassword(email: string, token: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/reset-password`, { email, token, newPassword });
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.currentUserSignal.set(null);
  }

  private startSession(res: AuthResponseDto): void {
    const user = this.toUser(res.user);
    localStorage.setItem(TOKEN_KEY, res.token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.currentUserSignal.set(user);
  }

  private toUser(dto: UserDto): User {
    return {
      id: dto.id,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      roles: dto.roles as UserRole[]
    };
  }

  private restoreUser(): User | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw || !localStorage.getItem(TOKEN_KEY)) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  }
}
