import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { AgentService } from './agent.service';
import { AgentDto } from './agent-api.adapter';
import { PagedResult } from '../models/paged-result.model';
import { AgentProfileInput } from '../models/agent.model';

describe('AgentService', () => {
  let service: AgentService;
  let httpMock: HttpTestingController;

  const makeAgentDto = (overrides: Partial<AgentDto> = {}): AgentDto => ({
    id: 1,
    isOwnProfile: false,
    name: 'Ana Lopez',
    email: 'ana@example.com',
    phone: '2221234567',
    company: null,
    isIndependent: true,
    photoUrl: null,
    bio: null,
    specialties: [],
    propertiesCount: 0,
    averageRating: null,
    reviewsCount: 0,
    viewCount: 0,
    ...overrides
  });

  const emptyPage = (): PagedResult<AgentDto> => ({ items: [], page: 1, pageSize: 20, totalCount: 0 });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(AgentService);
    httpMock = TestBed.inject(HttpTestingController);

    // The constructor fires its own refresh() immediately on construction — every test starts by
    // settling that request so it doesn't leak into (or get mistaken for) the request under test.
    httpMock.expectOne((req) => req.url === '/api/agents').flush(emptyPage());
  });

  afterEach(() => httpMock.verify());

  it('refresh() sends only the filters that were actually provided', () => {
    service.refresh({ name: 'Ana' }, 2, 10);

    const req = httpMock.expectOne((r) => r.url === '/api/agents');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('pageSize')).toBe('10');
    expect(req.request.params.get('name')).toBe('Ana');
    expect(req.request.params.has('specialty')).toBe(false);
    expect(req.request.params.has('company')).toBe(false);
    expect(req.request.params.has('minRating')).toBe(false);
    req.flush(emptyPage());
  });

  it('ignores a stale response that resolves after a newer refresh() call', () => {
    service.refresh({ name: 'first' });
    service.refresh({ name: 'second' });

    const reqs = httpMock.match((r) => r.url === '/api/agents');
    expect(reqs.length).toBe(2);

    // The newer call (second) resolves first; the older (first) call's response arrives late.
    reqs[1].flush({ items: [makeAgentDto({ id: 2, name: 'Second' })], page: 1, pageSize: 20, totalCount: 1 });
    reqs[0].flush({ items: [makeAgentDto({ id: 1, name: 'First' })], page: 1, pageSize: 20, totalCount: 1 });

    expect(service.agents().map((a) => a.id)).toEqual([2]);
  });

  it('sets loadError on a failed refresh() without clearing already-loaded agents', () => {
    service.refresh();
    httpMock
      .expectOne((r) => r.url === '/api/agents')
      .flush({ items: [makeAgentDto({ id: 1 })], page: 1, pageSize: 20, totalCount: 1 });
    expect(service.loadError()).toBe(false);

    service.refresh();
    httpMock.expectOne((r) => r.url === '/api/agents').flush('boom', { status: 500, statusText: 'Server Error' });

    expect(service.loadError()).toBe(true);
    expect(service.agents().map((a) => a.id)).toEqual([1]);
  });

  it('toggles loading true for the duration of the request', () => {
    expect(service.loading()).toBe(false);
    service.refresh();
    expect(service.loading()).toBe(true);

    httpMock.expectOne((r) => r.url === '/api/agents').flush(emptyPage());
    expect(service.loading()).toBe(false);
  });

  it('refresh() populates the agents and totalCount signals from the response', () => {
    service.refresh();

    const req = httpMock.expectOne((r) => r.url === '/api/agents');
    req.flush({ items: [makeAgentDto({ id: 7, name: 'Beto' })], page: 1, pageSize: 20, totalCount: 42 });

    expect(service.agents().map((a) => a.id)).toEqual([7]);
    expect(service.agents()[0].name).toBe('Beto');
    expect(service.totalCount()).toBe(42);
  });

  it('fetchById() maps the DTO, including null-to-undefined optional fields', (done) => {
    service.fetchById(7).subscribe((agent) => {
      expect(agent.id).toBe(7);
      expect(agent.company).toBeUndefined();
      expect(agent.photoUrl).toBeUndefined();
      done();
    });

    httpMock.expectOne('/api/agents/7').flush(makeAgentDto({ id: 7 }));
  });

  it('createMine() sends the profile fields as multipart form data and appends the result', () => {
    const input: AgentProfileInput = { phone: '2221112222', company: 'Acme', specialties: ['casas', 'terrenos'] };

    service.createMine(input).subscribe();

    const req = httpMock.expectOne('/api/agents');
    expect(req.request.method).toBe('POST');
    const body = req.request.body as FormData;
    expect(body.get('phone')).toBe('2221112222');
    expect(body.get('company')).toBe('Acme');
    expect(body.get('isIndependent')).toBe('false');
    expect(body.get('specialties')).toBe('casas,terrenos');
    expect(body.has('photo')).toBe(false);

    req.flush(makeAgentDto({ id: 9, name: 'New Agent' }));

    expect(service.agents().map((a) => a.id)).toEqual([9]);
  });

  it('updateMine() replaces the matching agent in the signal by id', () => {
    service.refresh();
    httpMock
      .expectOne((r) => r.url === '/api/agents')
      .flush({ items: [makeAgentDto({ id: 3, name: 'Old Name' })], page: 1, pageSize: 20, totalCount: 1 });

    service.updateMine({ phone: '2229998888' }).subscribe();
    const req = httpMock.expectOne('/api/agents/me');
    expect(req.request.method).toBe('PUT');
    req.flush(makeAgentDto({ id: 3, name: 'New Name' }));

    expect(service.agents().length).toBe(1);
    expect(service.agents()[0].name).toBe('New Name');
  });

  it('getListings()/getReviews()/addReview()/deleteReview()/contactAgent() hit the expected endpoints', () => {
    service.getListings(3).subscribe();
    httpMock.expectOne('/api/agents/3/listings').flush([]);

    service.getReviews(3).subscribe();
    httpMock.expectOne('/api/agents/3/reviews').flush([]);

    service.addReview(3, 5, 'Great agent').subscribe();
    const addReq = httpMock.expectOne('/api/agents/3/reviews');
    expect(addReq.request.method).toBe('POST');
    expect(addReq.request.body).toEqual({ rating: 5, comment: 'Great agent' });
    addReq.flush({ id: 1, reviewerName: 'Buyer', rating: 5, comment: 'Great agent', createdAt: '2026-01-01' });

    service.deleteReview(3, 1).subscribe();
    const deleteReq = httpMock.expectOne('/api/agents/3/reviews/1');
    expect(deleteReq.request.method).toBe('DELETE');
    deleteReq.flush(null);

    service.contactAgent(3, { name: 'Buyer', phone: '222', email: 'b@example.com', message: 'Hi' }).subscribe();
    const contactReq = httpMock.expectOne('/api/agents/3/contact');
    expect(contactReq.request.method).toBe('POST');
    contactReq.flush(null);
  });
});
