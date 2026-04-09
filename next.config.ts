import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for Docker deployment
  output: "standalone",
  // Allow images from any source for WoW item icons
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
