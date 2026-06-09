/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [],
  },
  experimental: {},
  // Ensure jsPDF and html2canvas (browser-only) don't cause SSR errors
  // by excluding them from the server bundle
  webpack: (config, { isServer }) => {
    if (isServer) {
      // These packages use browser APIs — prevent them from being bundled server-side
      config.externals = [...(config.externals || []), 'canvas', 'jsdom']
    }
    return config
  },
}

module.exports = nextConfig
