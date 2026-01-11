/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@axioma/shared', '@axioma/api-client'],
};

module.exports = nextConfig;
