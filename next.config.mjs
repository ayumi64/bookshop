/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  async redirects() {
    return [
      // Old sign-up emails used /api/auth/callback; the route lives at /auth/callback.
      {
        source: '/api/auth/callback',
        destination: '/auth/callback',
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        // Basic hardening headers. Fine-tune on the target domain.
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      // /reader must never be rendered inside an iframe.
      {
        source: '/reader/:path*',
        headers: [{ key: 'X-Frame-Options', value: 'DENY' }],
      },
    ];
  },
};

export default nextConfig;
