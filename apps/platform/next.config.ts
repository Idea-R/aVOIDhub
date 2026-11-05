import type { NextConfig } from 'next'

const isStaticExport = process.env.AVOID_STATIC_EXPORT === '1'

const nextConfig: NextConfig = {
  output: isStaticExport ? 'export' : undefined,
  trailingSlash: isStaticExport ? true : undefined,
  images: {
    unoptimized: isStaticExport,
  },
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  ...(isStaticExport
    ? {}
    : {
        async headers() {
          return [
            {
              source: '/:path*',
              headers: [
                { key: 'X-Content-Type-Options', value: 'nosniff' },
                { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                {
                  key: 'Permissions-Policy',
                  value: 'camera=(), microphone=(), geolocation=()',
                },
              ],
            },
            // The hosting adapter applies these rules too. Keep them after the
            // public default so callback URLs and private team navigation never
            // inherit its less restrictive same-origin referrer behavior.
            ...['/auth/:path*', '/teams/:path*', '/api/teams/:path*'].map(source => ({
              source,
              headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }],
            })),
          ]
        },
      }),
}

export default nextConfig
