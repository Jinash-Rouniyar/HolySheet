/**
 * Served at /spreadsheet behind the portfolio gateway. `standalone` is required
 * for the long-running agent loop; Vercel serverless is not the target.
 *
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  basePath: '/spreadsheet',
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['@anthropic-ai/sdk'],
  },
};

module.exports = nextConfig;
