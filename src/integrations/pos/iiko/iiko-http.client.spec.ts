import { IikoHttpClient } from './iiko-http.client';
import { IikoApiError } from './iiko.errors';

describe('IikoHttpClient', () => {
  const baseConfig = {
    enabled: true,
    baseUrl: 'https://api-ru.iiko.services',
    timeoutMs: 5000,
    apiKey: 'key',
    appId: '11111111-1111-1111-1111-111111111111',
    clientSecret: 'secret',
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('obtains v2 token and calls organizations with Bearer header', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              token: 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjk5OTk5OTk5OTl9.sig',
              correlationId: 'auth-corr',
            }),
          ),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              organizations: [{ id: 'org-1', name: 'Test' }],
            }),
          ),
      });

    const client = new IikoHttpClient({
      config: baseConfig,
      fetchImpl: fetchMock as typeof fetch,
    });

    const orgs = await client.fetchOrganizations();
    expect(orgs).toEqual({ organizations: [{ id: 'org-1', name: 'Test' }] });

    const orgCall = fetchMock.mock.calls[1] as [
      string,
      { headers: Record<string, string> },
    ];
    expect(orgCall[1].headers.Authorization).toMatch(/^Bearer /);
  });

  it('surfaces iiko error body on failed auth', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            correlationId: 'c-1',
            errorDescription: 'Login demoDelivery is not authorized.',
          }),
        ),
    });

    const client = new IikoHttpClient({
      config: {
        ...baseConfig,
        apiKey: undefined,
        appId: undefined,
        clientSecret: undefined,
        apiLogin: 'demoDelivery',
      },
      fetchImpl: fetchMock as typeof fetch,
    });

    await expect(client.getAccessToken(true)).rejects.toBeInstanceOf(
      IikoApiError,
    );
    await expect(client.getAccessToken(true)).rejects.toMatchObject({
      message: 'Login demoDelivery is not authorized.',
      correlationId: 'c-1',
    });
  });
});
