import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  async rewrites() {
    return { beforeFiles: [], afterFiles: [], fallback: [{ source: '/local-course-assets/:asset*', destination: '/api/course-release-assets/:asset*' }] }
  },
  // Local source material is published to Storage, never bundled into serverless functions.
  outputFileTracingExcludes: { '*': ['./local-artifacts/**/*', './output/**/*', './public/local-course-assets/**/*'] },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'uaupfsnfgenyqmlfljpi.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
};

export default nextConfig;
