/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'brandidentity.com' },
      { protocol: 'https', hostname: 'www.brandidentity.com' },
      { protocol: 'https', hostname: '*.amazonaws.com' },
    ],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://auth.magic.link https://*.livekit.cloud https://*.daily.co",
              "style-src 'self' 'unsafe-inline' https://brandidentity.com https://www.brandidentity.com https://fonts.googleapis.com",
              "font-src 'self' https://brandidentity.com https://www.brandidentity.com https://fonts.gstatic.com",
              "img-src 'self' data: https: blob:",
              "connect-src 'self' https://*.livekit.cloud wss://*.livekit.cloud https://*.daily.co https://api.daily.co https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com https://brandidentity.com https://www.brandidentity.com",
              "frame-src 'self' https://*.daily.co https://auth.magic.link",
              "media-src 'self' https://*.livekit.cloud blob:",
              "worker-src 'self' blob:",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
