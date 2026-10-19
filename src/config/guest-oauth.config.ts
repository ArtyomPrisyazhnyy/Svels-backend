export default () => ({
  guestOAuth: {
    googleClientIds: (process.env.GOOGLE_OAUTH_CLIENT_ID ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
    appleServiceId: process.env.APPLE_SERVICE_ID?.trim() ?? '',
    appleTeamId: process.env.APPLE_TEAM_ID?.trim() ?? '',
    appleRedirectUri: process.env.APPLE_REDIRECT_URI?.trim() ?? '',
  },
});
