import {
  BadRequestException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common/interfaces';
import { InternalErrorExceptionFilter } from './internal-error-exception.filter';

function createHost(reply: {
  status: jest.Mock;
  send: jest.Mock;
}): ArgumentsHost {
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getResponse: () => reply,
      getRequest: () => ({}),
    }),
  } as ArgumentsHost;
}

describe('InternalErrorExceptionFilter', () => {
  const filter = new InternalErrorExceptionFilter();

  it('keeps 4xx HttpException responses unchanged', () => {
    const send = jest.fn();
    const status = jest.fn().mockReturnValue({ send });
    const host = createHost({ status, send });
    const exception = new NotFoundException('missing');

    const baseCatch = jest
      .spyOn(
        Object.getPrototypeOf(InternalErrorExceptionFilter.prototype),
        'catch',
      )
      .mockImplementation(() => undefined);
    filter.catch(exception, host);
    expect(baseCatch).toHaveBeenCalledWith(exception, host);
    expect(status).not.toHaveBeenCalledWith(500);
    baseCatch.mockRestore();
  });

  it('hides 5xx and unknown errors behind Internal error + errorId', () => {
    const send = jest.fn();
    const status = jest.fn().mockReturnValue({ send });
    const host = createHost({ status, send });

    filter.catch(new HttpException('db down', 500), host);
    expect(status).toHaveBeenCalledWith(500);
    const firstCall = send.mock.calls[0] as
      | [Record<string, unknown>]
      | undefined;
    const firstPayload = firstCall?.[0] as {
      statusCode: number;
      message: string;
      errorId: string;
    };
    expect(firstPayload).toMatchObject({
      statusCode: 500,
      message: 'Internal error',
    });
    expect(firstPayload.errorId).toEqual(expect.any(String));

    send.mockClear();
    status.mockClear();
    filter.catch(new Error('secret details'), host);
    const secondCall = send.mock.calls[0] as
      | [Record<string, unknown>]
      | undefined;
    const secondPayload = secondCall?.[0] as {
      message: string;
      stack?: string;
    };
    expect(secondPayload.message).toBe('Internal error');
    expect(secondPayload.stack).toBeUndefined();
    expect(secondPayload.message).not.toContain('secret');
  });

  it('keeps validation 400 responses unchanged', () => {
    const send = jest.fn();
    const status = jest.fn().mockReturnValue({ send });
    const host = createHost({ status, send });
    const exception = new BadRequestException('invalid field');

    const baseCatch = jest
      .spyOn(
        Object.getPrototypeOf(InternalErrorExceptionFilter.prototype),
        'catch',
      )
      .mockImplementation(() => undefined);
    filter.catch(exception, host);
    expect(baseCatch).toHaveBeenCalledWith(exception, host);
    expect(status).not.toHaveBeenCalledWith(500);
    baseCatch.mockRestore();
  });
});
