/**
 * `basePath` keeps the public URL at /spreadsheet (proxied from jinash.com).
 * `standalone` is required for the long-running agent loop; not Vercel serverless.
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
