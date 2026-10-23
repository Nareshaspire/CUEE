import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  experimental: {
    agentUpgrade: "security",
  },
  images: {
    loader: "custom",
    loaderFile: "./figma-image-loader.ts",
  },
  allowedDevOrigins: [],
  // Prerender source maps add ~100 MB per static build worker
  enablePrerenderSourceMaps: false,
}

export default nextConfig
