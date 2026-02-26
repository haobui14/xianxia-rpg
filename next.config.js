/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  images: {
    unoptimized: true, // Netlify doesn't support Next.js Image Optimization
  },
}

module.exports = nextConfig
