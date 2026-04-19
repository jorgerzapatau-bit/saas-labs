// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Activa React Strict Mode para detectar bugs en desarrollo
  reactStrictMode: true,

  // Logging de fetch en desarrollo (útil para debug de Server Components)
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === "development",
    },
  },

  // Headers de seguridad HTTP
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options",    value: "nosniff" },
          { key: "X-Frame-Options",           value: "DENY" },
          { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
