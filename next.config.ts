import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  reloadOnOnline: true,
  disable:
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_ENABLE_SW !== "true",
});

const nextConfig: NextConfig = {
  serverExternalPackages: ["kysely"],
  turbopack: {},
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.googleapis.com https://*.firebaseapp.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' blob: data: https://*.googleusercontent.com; font-src 'self' https://fonts.gstatic.com data:; connect-src 'self' https://*.googleapis.com https://*.firebaseapp.com wss://*.firebaseio.com; frame-src 'self' https://*.firebaseapp.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests;",
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);