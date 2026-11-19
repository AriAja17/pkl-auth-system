import { findPolicy, POLICIES, TOKEN_ONLY_ROUTES } from './policies';

export type RouteDescriptor = { method: string; path: string };

const asKey = (route: RouteDescriptor): string =>
  `${route.method.toUpperCase()} ${route.path}`;

/** A protected route with no policy entry is a violation (fail closed). */
export function findUnregisteredRoutes(routes: RouteDescriptor[]): string[] {
  return routes
    .map(asKey)
    .filter((key) => !TOKEN_ONLY_ROUTES.has(key))
    .filter((key) => {
      const [method, ...rest] = key.split(' ');
      return !findPolicy(method, rest.join(' '));
    })
    .sort();
}

/** Policies whose controller is not mounted yet (planned Phase 03 routes). */
export function findUnusedPolicies(routes: RouteDescriptor[]): string[] {
  const mounted = new Set(routes.map(asKey));
  return Object.keys(POLICIES).filter((key) => !mounted.has(key)).sort();
}

type ExpressLayer = {
  route?: { path?: unknown; methods?: Record<string, unknown> };
};
type ExpressApp = {
  _router?: { stack?: ExpressLayer[] };
  router?: { stack?: ExpressLayer[] };
};

/** Reads the mounted Express routes so drift is detected at runtime, not by hand-maintained lists. */
export function collectRoutesFromExpress(instance: unknown): RouteDescriptor[] {
  const app = instance as ExpressApp | null;
  const stack = app?._router?.stack ?? app?.router?.stack ?? [];
  const routes: RouteDescriptor[] = [];

  for (const layer of stack) {
    if (!layer.route || typeof layer.route.path !== 'string') continue;
    for (const method of Object.keys(layer.route.methods ?? {})) {
      if (method.toUpperCase() === 'HEAD') continue;
      routes.push({ method: method.toUpperCase(), path: layer.route.path });
    }
  }
  return routes;
}

export function assertRoutePolicyConsistency(instance: unknown): RouteDescriptor[] {
  const routes = collectRoutesFromExpress(instance);
  const unregistered = findUnregisteredRoutes(routes);
  if (unregistered.length > 0) {
    throw new Error(
      `Unregistered protected route(s): ${unregistered.join(', ')}`,
    );
  }
  return routes;
}
