process.env.NODE_ENV = 'production';
process.env.STORAGE_DRIVER = 'local';
process.env.JWT_SECRET = 'e2e-production-jwt-secret-for-throttle-tests-only';
process.env.BEPAY_CREDENTIALS_ENCRYPTION_KEY =
  'e2e-bepay-encryption-key-32chars!!';
process.env.REVALIDATE_SECRET = 'e2e-revalidate-secret-32chars-min!!';
process.env.OTP_PEPPER = 'e2e-otp-pepper-32-characters-min!!';
process.env.API_PUBLIC_URL = 'https://api.e2e.test';
process.env.NEXT_SITE_URL = 'https://site.e2e.test';
