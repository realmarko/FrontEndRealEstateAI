import { Injectable, computed, signal } from '@angular/core';
import { AuthCredentials, RegisterDetails, User } from '../models/user.model';

interface StoredUser extends User {
  password: string;
}

const USERS_KEY = 'reapp_users';
const SESSION_KEY = 'reapp_session_user_id';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly currentUserSignal = signal<User | null>(this.restoreSession());

  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUserSignal() !== null);

  register(details: RegisterDetails): User {
    const users = this.readUsers();
    if (users.some((u) => u.email === details.email)) {
      throw new Error('auth.errors.emailTaken');
    }
    const user: StoredUser = {
      id: crypto.randomUUID(),
      name: details.name,
      email: details.email,
      password: details.password
    };
    users.push(user);
    this.writeUsers(users);
    return this.startSession(user);
  }

  login(credentials: AuthCredentials): User {
    const users = this.readUsers();
    const user = users.find(
      (u) => u.email === credentials.email && u.password === credentials.password
    );
    if (!user) {
      throw new Error('auth.errors.invalidCredentials');
    }
    return this.startSession(user);
  }

  logout(): void {
    localStorage.removeItem(SESSION_KEY);
    this.currentUserSignal.set(null);
  }

  private startSession(user: StoredUser): User {
    localStorage.setItem(SESSION_KEY, user.id);
    const publicUser: User = { id: user.id, name: user.name, email: user.email };
    this.currentUserSignal.set(publicUser);
    return publicUser;
  }

  private restoreSession(): User | null {
    const sessionId = localStorage.getItem(SESSION_KEY);
    if (!sessionId) {
      return null;
    }
    const user = this.readUsers().find((u) => u.id === sessionId);
    return user ? { id: user.id, name: user.name, email: user.email } : null;
  }

  private readUsers(): StoredUser[] {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as StoredUser[]) : [];
  }

  private writeUsers(users: StoredUser[]): void {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }
}
