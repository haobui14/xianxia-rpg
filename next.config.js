/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true, // Netlify doesn't support Next.js Image Optimization
  },
}

module.exports = nextConfig
