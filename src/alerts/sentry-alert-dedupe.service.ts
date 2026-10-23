import { Injectable } from '@nestjs/common';

const DEDUPE_WINDOW_MS = 30 * 60 * 1000;

@Injectable()
export class SentryAlertDedupeService {
  private readonly sentAtByIssueId = new Map<string, number>();

  shouldNotify(issueId: string, nowMs = Date.now()): boolean {
    const lastSentAt = this.sentAtByIssueId.get(issueId);
    if (lastSentAt !== undefined && nowMs - lastSentAt < DEDUPE_WINDOW_MS) {
      return false;
    }
    this.sentAtByIssueId.set(issueId, nowMs);
    return true;
  }

  reset(): void {
    this.sentAtByIssueId.clear();
  }
}
