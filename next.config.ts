import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // Browsers always request /favicon.ico; force FinderB icon instead of Vercel default.
    return [
      {
        source: "/favicon.ico",
        destination: "/icon.png",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
