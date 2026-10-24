import type { Scope } from '@sentry/nestjs';

interface RequestWithRoute {
  method?: string;
  routeOptions?: { url?: string };
  route?: { path?: string };
  params?: unknown;
  user?: { restaurantId?: string };
}

export function resolveHttpRoutePattern(request: RequestWithRoute): string {
  if (request.routeOptions?.url) {
    return request.routeOptions.url;
  }
  if (request.route?.path) {
    return request.route.path;
  }
  return 'unknown';
}

export function resolveRestaurantIdFromRequest(
  request: RequestWithRoute,
): string | undefined {
  const params =
    request.params && typeof request.params === 'object'
      ? (request.params as Record<string, string>)
      : undefined;
  const fromParams = params?.restaurantId ?? params?.id;
  if (fromParams) {
    return fromParams;
  }
  return request.user?.restaurantId;
}

export function applyServerErrorScope(
  scope: Scope,
  request: RequestWithRoute,
): void {
  scope.setTag('kind', 'server');
  const method = (request.method ?? 'GET').toUpperCase();
  const route = resolveHttpRoutePattern(request);
  scope.setTag('http.method', method);
  scope.setTag('http.route', route);

  const restaurantId = resolveRestaurantIdFromRequest(request);
  if (restaurantId) {
    scope.setTag('restaurantId', restaurantId);
  }
}
