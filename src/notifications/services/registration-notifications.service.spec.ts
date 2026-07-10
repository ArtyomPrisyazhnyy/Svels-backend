import { RegistrationNotificationsService } from './registration-notifications.service';

describe('RegistrationNotificationsService', () => {
  it('broadcasts submitted registration to active stream subscribers', (done) => {
    const service = new RegistrationNotificationsService();
    const registration = {
      id: '019ef5f4-49d3-757f-9a8a-f9458e52fd65',
      name: 'Test Cafe',
      description: null,
      address: 'Minsk',
      unp: '123456789',
      isChain: false,
      locations: [{ address: 'Minsk' }],
      applicantId: '019ef5f4-49d3-757f-9a8a-f9458e52fd66',
      status: 'pending',
      createdAt: new Date('2026-01-01T12:00:00.000Z'),
    };

    const stream$ = service.createStream();
    const subscription = stream$.subscribe({
      next: (event) => {
        const message = JSON.parse(String(event.data));
        if (message.type === 'heartbeat') {
          return;
        }

        expect(message).toEqual({
          type: 'registration.submitted',
          data: {
            ...registration,
            createdAt: registration.createdAt.toISOString(),
          },
        });
        subscription.unsubscribe();
        done();
      },
    });

    service.publishSubmitted(registration);
  });

  it('broadcasts reviewed registration id to active stream subscribers', (done) => {
    const service = new RegistrationNotificationsService();
    const requestId = '019ef5f4-49d3-757f-9a8a-f9458e52fd65';

    const stream$ = service.createStream();
    const subscription = stream$.subscribe({
      next: (event) => {
        const message = JSON.parse(String(event.data));
        if (message.type === 'heartbeat') {
          return;
        }

        expect(message).toEqual({
          type: 'registration.reviewed',
          data: { requestId },
        });
        subscription.unsubscribe();
        done();
      },
    });

    service.publishReviewed(requestId);
  });
});
