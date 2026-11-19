import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC_ROOT = join(process.cwd(), 'src');

const HTTP_METHOD_RE =
  /@(Get|Post|Put|Patch|Delete)\(\s*(?:'([^']*)'|"([^"]*)")?\s*\)/g;
const CONTROLLER_PREFIX_RE = /@Controller\(\s*(?:'([^']*)'|"([^"]*)")?\s*\)/;

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ProtectedRouteSpec {
  method: HttpMethod;
  /** Full path, e.g. restaurants/:restaurantId/menu/items */
  path: string;
  sourceFile: string;
  staffPermission: string | null;
}

function listControllerFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      listControllerFiles(full, acc);
      continue;
    }
    if (entry.endsWith('.controller.ts')) {
      acc.push(full);
    }
  }
  return acc;
}

function normalizeSlashes(...parts: string[]): string {
  return parts
    .filter((part) => part.length > 0)
    .join('/')
    .replace(/\/+/g, '/');
}

function extractStaffPermission(block: string): string | null {
  const match = block.match(
    /@StaffRoles\(\s*RestaurantPermission\.([A-Z_]+)\s*\)/,
  );
  return match ? match[1].toLowerCase() : null;
}

function hasRestaurantAccessGuard(block: string): boolean {
  return block.includes('RestaurantAccessGuard');
}

function hasJwtAuthGuard(block: string): boolean {
  return (
    block.includes('JwtAuthGuard') && !block.includes('OptionalJwtAuthGuard')
  );
}

function sliceMethodBlock(source: string, methodIndex: number): string {
  const tail = source.slice(methodIndex);
  const nextMethod = tail.search(/\n\s*@(Get|Post|Put|Patch|Delete)\(/);
  const end = nextMethod > 0 ? nextMethod : Math.min(tail.length, 2500);
  return tail.slice(0, end);
}

/**
 * Routes that require staff JWT + restaurant access (tenant boundary).
 * Generated from controller sources so new endpoints are picked up in e2e.
 */
export function discoverStaffProtectedRoutes(): ProtectedRouteSpec[] {
  const files = listControllerFiles(SRC_ROOT);
  const routes: ProtectedRouteSpec[] = [];

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const controllerMatch = CONTROLLER_PREFIX_RE.exec(source);
    const controllerPrefix = controllerMatch?.[1] ?? controllerMatch?.[2] ?? '';

    let match: RegExpExecArray | null;
    HTTP_METHOD_RE.lastIndex = 0;
    while ((match = HTTP_METHOD_RE.exec(source)) !== null) {
      const nestMethod = match[1];
      const subPath = match[2] ?? match[3] ?? '';
      const block = sliceMethodBlock(source, match.index);

      if (!hasRestaurantAccessGuard(block) || !hasJwtAuthGuard(block)) {
        continue;
      }

      const method = nestMethod.toUpperCase() as HttpMethod;
      const path = normalizeSlashes(controllerPrefix, subPath);
      routes.push({
        method,
        path,
        sourceFile: file.replace(`${process.cwd()}/`, ''),
        staffPermission: extractStaffPermission(block),
      });
    }
  }

  routes.sort((a, b) =>
    a.path === b.path
      ? a.method.localeCompare(b.method)
      : a.path.localeCompare(b.path),
  );

  return routes;
}
