export default () => ({
  nextSite: {
    url: process.env.NEXT_SITE_URL ?? 'http://localhost:3001',
    revalidateSecret: process.env.REVALIDATE_SECRET,
  },
});
