export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/', '/room/', '/onboard', '/select-org'],
      },
    ],
    sitemap: 'https://appchat.com/sitemap.xml',
    host: 'https://appchat.com',
  };
}
