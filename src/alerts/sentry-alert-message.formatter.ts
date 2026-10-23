import { escapeTelegramHtml } from '../leads/lead-telegram-notifier.service';

export interface SentryAlertIssueView {
  id: string;
  title: string;
  culprit?: string;
  permalink?: string;
  count?: string | number;
  userCount?: number;
  location?: string;
}

export interface SentryAlertContext {
  projectSlug?: string;
  kindTag?: string;
  environment?: string;
  release?: string;
  issue: SentryAlertIssueView;
}

export function resolveSentryAlertCategoryEmoji(
  projectSlug: string | undefined,
  kindTag: string | undefined,
): string {
  if (kindTag === 'network') {
    return '📶 Сеть пользователя';
  }

  switch (projectSlug) {
    case 'svels-backend':
      return '🔴 Сервер';
    case 'svels-client':
      return '🟠 Сайт';
    case 'svels-mobile':
      return '🟣 Мобилка';
    default:
      return '⚪️ Ошибка';
  }
}

export function buildSentryAlertTelegramMessage(
  context: SentryAlertContext,
): string {
  const category = resolveSentryAlertCategoryEmoji(
    context.projectSlug,
    context.kindTag,
  );
  const lines = [
    `<b>${escapeTelegramHtml(category)}</b>`,
    `<b>Заголовок:</b> ${escapeTelegramHtml(context.issue.title)}`,
  ];

  const location =
    context.issue.culprit?.trim() || context.issue.location?.trim();
  if (location) {
    lines.push(`<b>Место:</b> ${escapeTelegramHtml(location)}`);
  }

  if (context.environment) {
    lines.push(`<b>Окружение:</b> ${escapeTelegramHtml(context.environment)}`);
  }

  if (context.release) {
    lines.push(`<b>Релиз:</b> ${escapeTelegramHtml(context.release)}`);
  }

  if (context.issue.count !== undefined && context.issue.count !== '') {
    lines.push(
      `<b>Событий:</b> ${escapeTelegramHtml(String(context.issue.count))}`,
    );
  }

  if (context.issue.userCount !== undefined) {
    lines.push(
      `<b>Пользователей:</b> ${escapeTelegramHtml(String(context.issue.userCount))}`,
    );
  }

  if (context.issue.permalink) {
    lines.push(
      `<a href="${escapeTelegramHtml(context.issue.permalink)}">Открыть в Sentry</a>`,
    );
  }

  lines.push('', `<i>Issue ID: ${escapeTelegramHtml(context.issue.id)}</i>`);
  return lines.join('\n');
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function readString(
  record: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = record?.[key];
  return typeof value === 'string' ? value : undefined;
}

function readTags(
  record: Record<string, unknown> | undefined,
): Record<string, string> | undefined {
  const tags = record?.tags;
  if (!tags || typeof tags !== 'object') {
    return undefined;
  }
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(tags)) {
    if (typeof value === 'string') {
      result[key] = value;
    }
  }
  return result;
}

export function extractKindTagFromPayload(
  payload: Record<string, unknown>,
): string | undefined {
  const data = asRecord(payload.data);
  const event = asRecord(data?.event);
  const issue = asRecord(data?.issue);
  const tags =
    readTags(event) ?? readTags(issue) ?? readTags(asRecord(payload.event));
  return tags?.kind;
}

export function extractSentryAlertContext(
  payload: Record<string, unknown>,
): SentryAlertContext | null {
  const data = asRecord(payload.data);
  const issueRecord = asRecord(data?.issue);
  if (!issueRecord) {
    return null;
  }

  const issueId = readString(issueRecord, 'id');
  const title =
    readString(issueRecord, 'title') ??
    readString(asRecord(issueRecord.metadata), 'title');
  if (!issueId || !title) {
    return null;
  }

  const project =
    asRecord(issueRecord.project) ??
    asRecord(data?.project) ??
    asRecord(payload.project);
  const event = asRecord(data?.event);

  const countRaw = issueRecord.count;
  const count =
    typeof countRaw === 'string' || typeof countRaw === 'number'
      ? countRaw
      : undefined;
  const userCountRaw = issueRecord.userCount;
  const userCount = typeof userCountRaw === 'number' ? userCountRaw : undefined;

  return {
    projectSlug: readString(project, 'slug'),
    kindTag: extractKindTagFromPayload(payload),
    environment:
      readString(event, 'environment') ??
      readString(issueRecord, 'environment'),
    release: readString(event, 'release') ?? readString(issueRecord, 'release'),
    issue: {
      id: issueId,
      title,
      culprit: readString(issueRecord, 'culprit'),
      permalink:
        readString(issueRecord, 'web_url') ??
        readString(issueRecord, 'permalink'),
      count,
      userCount,
      location: readString(asRecord(issueRecord.metadata), 'location'),
    },
  };
}

export function isActionableSentryWebhook(
  payload: Record<string, unknown>,
): boolean {
  const action = readString(payload, 'action');
  const resource = readString(payload, 'resource');

  if (
    resource === 'issue' &&
    (action === 'created' || action === 'triggered')
  ) {
    return true;
  }

  if (resource === 'event_alert' && action === 'triggered') {
    return true;
  }

  return false;
}
