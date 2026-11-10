import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject, defer, throwError } from 'rxjs';
import { User } from '../models/user.model';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';
import { TranslationService } from '../services/translation.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let authSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let notificationSpy: jasmine.SpyObj<NotificationService>;

  const fakeUser = { id: '1', firstName: 'A', lastName: 'B', email: 'a@b.com', roles: [] } as User;

  beforeEach(() => {
    authSpy = jasmine.createSpyObj<AuthService>('AuthService', ['logout', 'refresh'], { token: 'jwt-abc' });
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate', 'navigateByUrl']);
    notificationSpy = jasmine.createSpyObj<NotificationService>('NotificationService', ['error']);
    const translationSpy = jasmine.createSpyObj<TranslationService>('TranslationService', {
      path: '/login'
    });

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authSpy },
        { provide: Router, useValue: routerSpy },
        { provide: NotificationService, useValue: notificationSpy },
        { provide: TranslationService, useValue: translationSpy }
      ]
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('attaches the bearer token to outgoing requests', () => {
    http.get('/api/listings').subscribe();

    const req = httpMock.expectOne('/api/listings');
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-abc');
    req.flush({});
  });

  it('silently refreshes and retries on a 401 from an authenticated request', () => {
    authSpy.refresh.and.returnValue(defer(() => {
      Object.defineProperty(authSpy, 'token', { value: 'jwt-new', configurable: true });
      return [fakeUser];
    }));

    http.get('/api/listings').subscribe({ error: () => fail('should not error') });

    httpMock.expectOne('/api/listings').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(authSpy.refresh).toHaveBeenCalled();
    const retried = httpMock.expectOne('/api/listings');
    expect(retried.request.headers.get('Authorization')).toBe('Bearer jwt-new');
    retried.flush({});

    expect(authSpy.logout).not.toHaveBeenCalled();
    expect(routerSpy.navigateByUrl).not.toHaveBeenCalled();
  });

  it('logs out and redirects to /login when the refresh itself fails', () => {
    authSpy.refresh.and.returnValue(throwError(() => new Error('refresh token dead')));
    authSpy.logout.and.callFake(() => Object.defineProperty(authSpy, 'token', { value: null, configurable: true }));

    http.get('/api/listings').subscribe({ error: () => {} });

    httpMock.expectOne('/api/listings').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(authSpy.logout).toHaveBeenCalled();
    expect(notificationSpy.error).toHaveBeenCalledWith('auth.errors.sessionExpired');
    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('does not log out on a 401 from /auth/login (wrong credentials, not an expired session)', () => {
    http.post('/api/auth/login', { email: 'a@b.com', password: 'wrong' }).subscribe({ error: () => {} });

    httpMock.expectOne('/api/auth/login').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(authSpy.refresh).not.toHaveBeenCalled();
    expect(authSpy.logout).not.toHaveBeenCalled();
    expect(routerSpy.navigateByUrl).not.toHaveBeenCalled();
  });

  it('only logs out once when several authenticated requests 401 together and refresh fails', () => {
    // A Subject (not a plain throwError) so both concurrent callers' subscriptions resolve from
    // the exact same emission, mirroring AuthService.refresh()'s real shareReplay dedup.
    const refreshFailure$ = new Subject<User>();
    authSpy.refresh.and.returnValue(refreshFailure$.asObservable());
    authSpy.logout.and.callFake(() => Object.defineProperty(authSpy, 'token', { value: null, configurable: true }));

    http.get('/api/agents/1').subscribe({ error: () => {} });
    http.get('/api/agents/1/reviews').subscribe({ error: () => {} });

    httpMock.expectOne('/api/agents/1').flush(null, { status: 401, statusText: 'Unauthorized' });
    httpMock.expectOne('/api/agents/1/reviews').flush(null, { status: 401, statusText: 'Unauthorized' });

    refreshFailure$.error(new Error('refresh token dead'));

    expect(authSpy.logout).toHaveBeenCalledTimes(1);
    expect(notificationSpy.error).toHaveBeenCalledTimes(1);
    expect(routerSpy.navigateByUrl).toHaveBeenCalledTimes(1);
  });
});
