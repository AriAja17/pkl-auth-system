import {
  assertRoutePolicyConsistency,
  collectRoutesFromExpress,
  findUnregisteredRoutes,
  findUnusedPolicies,
} from './policy-consistency';
import { findPolicy } from './policies';

describe('route / policy consistency', () => {
  it('detects protected routes that are not registered', () => {
    expect(
      findUnregisteredRoutes([
        { method: 'GET', path: '/admin/users' },
        { method: 'POST', path: '/admin/menus' },
        { method: 'GET', path: '/admin/secret' },
      ]),
    ).toEqual(['GET /admin/secret']);
  });

  it('exempts token-only routes from the permission registry', () => {
    expect(
      findUnregisteredRoutes([
        { method: 'GET', path: '/' },
        { method: 'POST', path: '/auth/login' },
        { method: 'GET', path: '/auth/me' },
      ]),
    ).toEqual([]);
  });

  it('reports planned policies that are not implemented yet', () => {
    const unused = findUnusedPolicies([{ method: 'GET', path: '/admin/users' }]);
    expect(unused).toContain('POST /admin/users');
    expect(unused).toContain('GET /admin/audit-logs');
  });

  it('resolves static routes before parameter routes', () => {
    expect(findPolicy('GET', '/admin/permissions/drift')?.permission).toBe(
      'read:permission',
    );
    expect(findPolicy('GET', '/admin/users/123')?.permission).toBe('read:user');
  });

  it('collects Express routes and fails closed on unregistered ones', () => {
    const instance = {
      _router: {
        stack: [
          { route: { path: '/admin/users', methods: { get: true } } },
          { route: { path: '/admin/secret', methods: { get: true, head: true } } },
        ],
      },
    };

    expect(collectRoutesFromExpress(instance)).toEqual([
      { method: 'GET', path: '/admin/users' },
      { method: 'GET', path: '/admin/secret' },
    ]);
    expect(() => assertRoutePolicyConsistency(instance)).toThrow(
      /Unregistered protected route/,
    );
  });

  it('accepts a fully registered route set', () => {
    const instance = {
      _router: {
        stack: [{ route: { path: '/articles', methods: { get: true } } }],
      },
    };
    expect(() => assertRoutePolicyConsistency(instance)).not.toThrow();
  });
});
