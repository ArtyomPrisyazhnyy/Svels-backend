export class IikoApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly correlationId?: string,
    readonly errorCode?: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'IikoApiError';
  }
}

export class IikoNotConfiguredError extends Error {
  constructor(message = 'iiko POS integration is not configured') {
    super(message);
    this.name = 'IikoNotConfiguredError';
  }
}
