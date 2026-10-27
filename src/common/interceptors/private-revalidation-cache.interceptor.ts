import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

function buildEtag(payload: string): string {
  const digest = createHash('sha256').update(payload).digest('base64url');
  return `"${digest}"`;
}

@Injectable()
export class PrivateRevalidationCacheInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<{
      headers: Record<string, string | undefined>;
    }>();
    const res = http.getResponse<{
      header: (name: string, value: string) => void;
    }>();

    return next.handle().pipe(
      map((body: unknown) => {
        const payload = JSON.stringify(body ?? null);
        const etag = buildEtag(payload);
        res.header('Cache-Control', 'private, no-cache');
        res.header('ETag', etag);

        const ifNoneMatch = req.headers['if-none-match'];
        if (ifNoneMatch && ifNoneMatch === etag) {
          throw new HttpException('', HttpStatus.NOT_MODIFIED);
        }

        return body;
      }),
    );
  }
}
