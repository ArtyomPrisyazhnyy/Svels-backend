import { JwtService } from '@nestjs/jwt';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import {
  GUEST_APPLE_ID_TOKEN_VERIFIER,
  GUEST_GOOGLE_ID_TOKEN_VERIFIER,
} from '../src/common/constants/injection-tokens';
import { createE2eApp } from './helpers/e2e-app';
import {
  E2eGuestAppleIdTokenVerifier,
  E2eGuestGoogleIdTokenVerifier,
} from './helpers/guest-oauth-test-verifiers';
import { seedRestaurantBase } from './helpers/restaurant-seed';

interface GuestOAuthAuthBody {
  accessToken: string;
  isNew: boolean;
  needsPhone: boolean;
  user: {
    id: string;
    role: string;
    restaurantId: string;
    phone?: string;
  };
}

describe('Guest OAuth (e2e)', () => {
  let app: NestFastifyApplication;
  let restaurantId: string;
  let otherRestaurantId: string;
  let jwtService: JwtService;
  const runId = Date.now();

  const googleEnv = {
    GOOGLE_OAUTH_CLIENT_ID: 'e2e-google-client',
    APPLE_SERVICE_ID: 'com.e2e.service',
    APPLE_TEAM_ID: 'E2ETEAM',
    APPLE_REDIRECT_URI: 'https://e2e.example/apple/callback',
  };

  beforeAll(async () => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = googleEnv.GOOGLE_OAUTH_CLIENT_ID;
    process.env.APPLE_SERVICE_ID = googleEnv.APPLE_SERVICE_ID;
    process.env.APPLE_TEAM_ID = googleEnv.APPLE_TEAM_ID;
    process.env.APPLE_REDIRECT_URI = googleEnv.APPLE_REDIRECT_URI;

    app = await createE2eApp((builder) => {
      builder.overrideProvider(GUEST_GOOGLE_ID_TOKEN_VERIFIER).useFactory({
        factory: (jwt: JwtService) => new E2eGuestGoogleIdTokenVerifier(jwt),
        inject: [JwtService],
      });
      builder.overrideProvider(GUEST_APPLE_ID_TOKEN_VERIFIER).useFactory({
        factory: (jwt: JwtService) => new E2eGuestAppleIdTokenVerifier(jwt),
        inject: [JwtService],
      });
    });

    jwtService = app.get(JwtService);
    const dataSource = app.get(DataSource);
    const seeded = await seedRestaurantBase(dataSource, runId, {
      restaurantName: 'OAuth E2E Cafe',
    });
    restaurantId = seeded.restaurantId;
    const other = await seedRestaurantBase(dataSource, `${runId}-venue-b`, {
      restaurantName: 'OAuth E2E Cafe B',
    });
    otherRestaurantId = other.restaurantId;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  function signGoogleToken(claims: {
    sub: string;
    email: string;
    given_name?: string;
    family_name?: string;
  }): string {
    return jwtService.sign(claims);
  }

  function signAppleToken(claims: { sub: string; email: string }): string {
    return jwtService.sign(claims);
  }

  it('rejects unknown body fields on OAuth endpoints (ValidationPipe whitelist)', async () => {
    const idToken = signGoogleToken({
      sub: `google-${runId}-validation`,
      email: `validation-${runId}@example.com`,
    });

    await request(app.getHttpServer())
      .post(`/restaurants/${restaurantId}/auth/oauth/google`)
      .send({ idToken, extraField: 'x' })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/restaurants/${restaurantId}/auth/oauth/apple`)
      .send({
        idToken,
        firstName: 'A',
        lastName: 'B',
        unknown: true,
      })
      .expect(400);
  });

  it('returns configured OAuth providers', async () => {
    const res = await request(app.getHttpServer())
      .get(`/restaurants/${restaurantId}/auth/oauth/providers`)
      .expect(200);

    expect(res.body).toEqual({
      google: {
        enabled: true,
        clientId: googleEnv.GOOGLE_OAUTH_CLIENT_ID,
      },
      apple: {
        enabled: true,
        serviceId: googleEnv.APPLE_SERVICE_ID,
        redirectUri: googleEnv.APPLE_REDIRECT_URI,
      },
    });
  });

  it('signs in a new Google guest without phone', async () => {
    const idToken = signGoogleToken({
      sub: `google-${runId}-1`,
      email: `oauth-google-${runId}@example.com`,
      given_name: 'Oauth',
      family_name: 'Guest',
    });

    const res = await request(app.getHttpServer())
      .post(`/restaurants/${restaurantId}/auth/oauth/google`)
      .send({ idToken })
      .expect(200);

    const body = res.body as GuestOAuthAuthBody;
    expect(body.isNew).toBe(true);
    expect(body.needsPhone).toBe(true);
    expect(body.user.phone).toBeUndefined();
    expect(body.accessToken).toEqual(expect.any(String));
  });

  it('returns the same Google guest on repeat login', async () => {
    const sub = `google-${runId}-repeat`;
    const email = `oauth-google-repeat-${runId}@example.com`;
    const idToken = signGoogleToken({ sub, email });

    const first = await request(app.getHttpServer())
      .post(`/restaurants/${restaurantId}/auth/oauth/google`)
      .send({ idToken })
      .expect(200);
    const second = await request(app.getHttpServer())
      .post(`/restaurants/${restaurantId}/auth/oauth/google`)
      .send({ idToken })
      .expect(200);

    const firstBody = first.body as GuestOAuthAuthBody;
    const secondBody = second.body as GuestOAuthAuthBody;
    expect(secondBody.user.id).toBe(firstBody.user.id);
    expect(secondBody.isNew).toBe(false);
  });

  it('signs in with Apple and applies first-time name', async () => {
    const idToken = signAppleToken({
      sub: `apple-${runId}-1`,
      email: `oauth-apple-${runId}@privaterelay.appleid.com`,
    });

    const res = await request(app.getHttpServer())
      .post(`/restaurants/${restaurantId}/auth/oauth/apple`)
      .send({
        idToken,
        firstName: 'Apple',
        lastName: 'Guest',
      })
      .expect(200);

    const body = res.body as GuestOAuthAuthBody;
    expect(body.isNew).toBe(true);
    expect(body.needsPhone).toBe(true);
  });

  it('links Apple login to an existing OTP guest by email', async () => {
    const phone = '375290000001';
    const email = `link-${runId}@example.com`;

    await app.get(DataSource).query(
      `INSERT INTO users (id, email, phone, "passwordHash", "firstName", "lastName", role, "authProvider", "restaurantId", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, NULL, 'Link', 'Guest', 'user', 'local', $4, now(), now())`,
      [uuidv7(), email, phone, restaurantId],
    );

    const idToken = signAppleToken({
      sub: `apple-link-${runId}`,
      email,
    });

    const res = await request(app.getHttpServer())
      .post(`/restaurants/${restaurantId}/auth/oauth/apple`)
      .send({ idToken })
      .expect(200);

    const body = res.body as GuestOAuthAuthBody;
    expect(body.isNew).toBe(false);
    expect(body.needsPhone).toBe(false);
    expect(body.user.phone).toBe(phone);
  });

  it('isolates the same Google sub per venue (distinct guests; token not valid at other venue)', async () => {
    const sub = `google-shared-sub-${runId}`;
    const email = `shared-oauth-${runId}@example.com`;
    const idToken = signGoogleToken({ sub, email });

    const venueA = await request(app.getHttpServer())
      .post(`/restaurants/${restaurantId}/auth/oauth/google`)
      .send({ idToken })
      .expect(200);
    const venueB = await request(app.getHttpServer())
      .post(`/restaurants/${otherRestaurantId}/auth/oauth/google`)
      .send({ idToken })
      .expect(200);

    const bodyA = venueA.body as GuestOAuthAuthBody;
    const bodyB = venueB.body as GuestOAuthAuthBody;

    expect(bodyA.isNew).toBe(true);
    expect(bodyB.isNew).toBe(true);
    expect(bodyA.user.id).not.toBe(bodyB.user.id);
    expect(bodyA.user.restaurantId).toBe(restaurantId);
    expect(bodyB.user.restaurantId).toBe(otherRestaurantId);
    expect(bodyA.accessToken).not.toBe(bodyB.accessToken);

    await request(app.getHttpServer())
      .get(`/restaurants/${otherRestaurantId}/me/addresses`)
      .set('Authorization', `Bearer ${bodyA.accessToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get(`/restaurants/${restaurantId}/me/addresses`)
      .set('Authorization', `Bearer ${bodyA.accessToken}`)
      .expect(200);
  });
});
