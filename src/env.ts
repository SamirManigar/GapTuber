import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    AUTH_SECRET: z.string().min(1),
    AUTH_GOOGLE_ID: z.string().min(1),
    AUTH_GOOGLE_SECRET: z.string().min(1),
    GROQ_API_KEY: z.string().min(1),
    GROQ_API_KEY_2: z.string().optional(),
    GROQ_API_KEY_3: z.string().optional(),
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
    YOUTUBE_API_KEY: z.string().min(1),
    YOUTUBE_API_KEY_2: z.string().optional(),
    YOUTUBE_API_KEY_3: z.string().optional(),
    TOKEN_ENCRYPTION_KEY: z.string().length(64),
    GEMINI_API_KEY: z.string().optional(),
    OPENROUTER_API_KEY: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
    NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  },
  // If you're using Next.js < 13.4.4, you'll need to specify the runtimeEnv manually
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
    AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    GROQ_API_KEY_2: process.env.GROQ_API_KEY_2,
    GROQ_API_KEY_3: process.env.GROQ_API_KEY_3,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
    YOUTUBE_API_KEY_2: process.env.YOUTUBE_API_KEY_2,
    YOUTUBE_API_KEY_3: process.env.YOUTUBE_API_KEY_3,
    TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  },
});
