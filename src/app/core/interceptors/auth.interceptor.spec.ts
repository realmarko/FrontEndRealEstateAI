import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let authSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let notificationSpy: jasmine.SpyObj<NotificationService>;

  beforeEach(() => {
    authSpy = jasmine.createSpyObj<AuthService>('AuthService', ['logout'], { token: 'jwt-abc' });
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);
    notificationSpy = jasmine.createSpyObj<NotificationService>('NotificationService', ['error']);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authSpy },
        { provide: Router, useValue: routerSpy },
        { provide: NotificationService, useValue: notificationSpy }
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

  it('logs out and redirects to /login on a 401 from an authenticated request', () => {
    http.get('/api/listings').subscribe({ error: () => {} });

    httpMock.expectOne('/api/listings').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(authSpy.logout).toHaveBeenCalled();
    expect(notificationSpy.error).toHaveBeenCalledWith('auth.errors.sessionExpired');
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('does not log out on a 401 from /auth/login (wrong credentials, not an expired session)', () => {
    http.post('/api/auth/login', { email: 'a@b.com', password: 'wrong' }).subscribe({ error: () => {} });

    httpMock.expectOne('/api/auth/login').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(authSpy.logout).not.toHaveBeenCalled();
    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });

  it('only logs out once when several authenticated requests all 401 together', () => {
    authSpy.logout.and.callFake(() => Object.defineProperty(authSpy, 'token', { value: null }));

    http.get('/api/agents/1').subscribe({ error: () => {} });
    http.get('/api/agents/1/reviews').subscribe({ error: () => {} });

    httpMock.expectOne('/api/agents/1').flush(null, { status: 401, statusText: 'Unauthorized' });
    httpMock.expectOne('/api/agents/1/reviews').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(authSpy.logout).toHaveBeenCalledTimes(1);
    expect(notificationSpy.error).toHaveBeenCalledTimes(1);
    expect(routerSpy.navigate).toHaveBeenCalledTimes(1);
  });
});
