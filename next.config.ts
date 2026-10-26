import type { NextConfig } from "next";

// Fonts and the default logo the ticket PDF renderer reads from disk
// (lib/tickets/assets.ts), traced into every function that renders tickets.
const TICKET_PDF_ASSETS = ['./lib/tickets/fonts/**/*', './lib/tickets/assets/**/*']

const nextConfig: NextConfig = {
  devIndicators: false,
  // Barcode/QR encoder for tickets: large CommonJS build, loaded from node_modules at runtime.
  serverExternalPackages: ['bwip-js'],
  async rewrites() {
    return { beforeFiles: [], afterFiles: [], fallback: [{ source: '/local-course-assets/:asset*', destination: '/api/course-release-assets/:asset*' }] }
  },
  // Local source material is published to Storage, never bundled into serverless functions.
  outputFileTracingExcludes: { '*': ['./local-artifacts/**/*', './output/**/*', './public/local-course-assets/**/*'] },
  outputFileTracingIncludes: {
    '/api/webhooks/stripe': TICKET_PDF_ASSETS,
    '/api/events/**/*': TICKET_PDF_ASSETS,
    '/api/tickets/**/*': TICKET_PDF_ASSETS,
    '/api/admin/events/**/*': TICKET_PDF_ASSETS,
    '/admin/events/**/*': TICKET_PDF_ASSETS,
    '/tickets/**/*': TICKET_PDF_ASSETS,
  },
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
