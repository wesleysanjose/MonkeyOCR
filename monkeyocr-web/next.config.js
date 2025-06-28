/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  async rewrites() {
    return [
      {
        source: '/api/monkeyocr/:path*',
        destination: 'http://epyc:7861/:path*',
      },
    ]
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
  // Increase timeout for API routes
  serverRuntimeConfig: {
    apiTimeout: 600000, // 10 minutes
  },
  // Experimental features for better proxy handling
  experimental: {
    proxyTimeout: 600000, // 10 minutes
  },
}

module.exports = nextConfig