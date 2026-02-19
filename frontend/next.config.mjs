/** @type {import('next').NextConfig} */
const nextConfig = {
  productionBrowserSourceMaps: false,

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },

  experimental: {
    optimizePackageImports: [
      "framer-motion",
      "lucide-react",
      "@daml/ledger",
    ],
  },
};

export default nextConfig;
