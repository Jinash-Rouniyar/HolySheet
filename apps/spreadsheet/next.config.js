/**
 * The app is served under /spreadsheet so it can sit behind the portfolio
 * gateway at jinash.com/spreadsheet. All API routes therefore live under
 * /spreadsheet/api/* (see src/lib/config.ts BASE_PATH, kept in sync with this).
 *
 * `output: 'standalone'` produces a self-contained Node server for the
 * self-hosted deployment target (Fly/Render/Railway) that the agent loop,
 * SSE streaming and bash sandbox require. Vercel serverless is intentionally
 * not the target.
 *
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  basePath: '/spreadsheet',
  reactStrictMode: true,
  output: 'standalone',
  // Syncfusion + html2canvas are heavy client-only libs; keep them out of any
  // server bundle. They are always imported inside 'use client' modules loaded
  // with next/dynamic({ ssr: false }).
  experimental: {
    serverComponentsExternalPackages: ['@anthropic-ai/sdk'],
  },
};

module.exports = nextConfig;
