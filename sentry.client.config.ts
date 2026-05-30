import * as Sentry from "@sentry/nextjs";

const isProd = process.env.NODE_ENV === "production";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 10% of traces in production, 100% in dev for easier debugging
  tracesSampleRate: isProd ? 0.1 : 1.0,

  debug: false,

  // Always capture 100% of sessions that have an error
  replaysOnErrorSampleRate: 1.0,

  // 5% session replay in production — enough signal without burning quota
  replaysSessionSampleRate: isProd ? 0.05 : 0.1,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});

