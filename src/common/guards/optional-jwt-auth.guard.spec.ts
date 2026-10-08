import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';

describe('OptionalJwtAuthGuard', () => {
  const guard = new OptionalJwtAuthGuard();

  it('handleRequest returns null for missing or invalid user', () => {
    expect(guard.handleRequest(new Error('jwt expired'), null)).toBeNull();
    expect(guard.handleRequest(null, null)).toBeNull();
  });

  it('handleRequest returns user when JWT is valid', () => {
    const user = { id: 'u1' };
    expect(guard.handleRequest(null, user)).toEqual(user);
  });
});
