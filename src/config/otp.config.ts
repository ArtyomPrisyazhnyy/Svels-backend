export default () => ({
  otp: {
    ttlSeconds: parseInt(process.env.OTP_TTL_SECONDS ?? '300', 10),
    resendSeconds: parseInt(process.env.OTP_RESEND_SECONDS ?? '60', 10),
    telegramWaitMs: parseInt(process.env.OTP_TELEGRAM_WAIT_MS ?? '20000', 10),
    codeLength: parseInt(process.env.OTP_CODE_LENGTH ?? '6', 10),
    maxVerifyAttempts: parseInt(process.env.OTP_MAX_VERIFY_ATTEMPTS ?? '5', 10),
    pepper: process.env.OTP_PEPPER ?? process.env.JWT_SECRET ?? 'otp-dev-pepper',
  },
  telegramGateway: {
    token: process.env.TELEGRAM_GATEWAY_TOKEN ?? '',
    apiUrl: process.env.TELEGRAM_GATEWAY_API_URL ?? 'https://gatewayapi.telegram.org',
  },
  smsBy: {
    token: process.env.SMS_BY_TOKEN ?? '',
    alphaname: process.env.SMS_BY_ALPHANAME ?? 'Svels',
    apiUrl: process.env.SMS_BY_API_URL ?? 'https://app.sms.by/api/v1',
  },
  smsc: {
    login: process.env.SMSC_LOGIN ?? '',
    password: process.env.SMSC_PASSWORD ?? '',
    sender: process.env.SMSC_SENDER ?? 'Svels',
    apiUrl: process.env.SMSC_API_URL ?? 'https://smsc.ru/sys/send.php',
  },
});
