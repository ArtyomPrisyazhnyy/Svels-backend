export default () => ({
  setPassword: {
    urlBase:
      process.env.SET_PASSWORD_URL_BASE?.trim() ??
      'http://localhost:3001/auth/set-password',
    ttlHours: parseInt(process.env.SET_PASSWORD_TTL_HOURS ?? '72', 10),
  },
});
