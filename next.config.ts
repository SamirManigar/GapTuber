import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@neondatabase/serverless"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "i.ytimg.com",
      },
      {
        protocol: "https",
        hostname: "yt3.ggpht.com",
      },
    ],
  },
  // CORS is handled dynamically in /api/analyze/route.ts (required for credentials: include)
  async headers() {
    const isProd = process.env.NODE_ENV === "production";
    const csp = [
      "default-src 'self'",
      // Razorpay checkout.js + Lemon Squeezy scripts allowed
      "script-src 'self' 'unsafe-inline' https://www.youtube.com https://checkout.razorpay.com https://app.lemonsqueezy.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://lh3.googleusercontent.com https://i.ytimg.com https://yt3.ggpht.com https://aurionstack.dev https://api.razorpay.com",
      // Allow API calls to payment gateways + existing services
      "connect-src 'self' https://*.sentry.io https://*.upstash.io https://*.ingest.sentry.io wss://*.neon.tech https://*.neon.tech https://api.groq.com https://api.razorpay.com https://checkout.razorpay.com https://api.lemonsqueezy.com",
      // Allow Razorpay modal iframe + YouTube
      "frame-src https://www.youtube.com https://api.razorpay.com https://checkout.razorpay.com https://app.lemonsqueezy.com",
      "media-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      // Prevent clickjacking via form submissions to external sites
      "form-action 'self'",
      // Prevent MIME type sniffing attacks
      "upgrade-insecure-requests",
    ].join("; ");


    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            // Use report-only in dev so you can see violations without breaking anything
            key: isProd
              ? "Content-Security-Policy"
              : "Content-Security-Policy-Report-Only",
            value: csp,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
