import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { env } from "@/env";
import * as schema from "./schema";

// Use WebSocket for persistent connections (much faster than HTTP per-query)
neonConfig.webSocketConstructor = ws;

const connectionString = env.DATABASE_URL;

if (!connectionString) {
    console.error("❌ DATABASE_URL is missing from environment variables!");
    throw new Error("DATABASE_URL is not defined. Please check your .env.local file.");
}

// Pool is reused across serverless invocations via module caching
const pool = new Pool({ connectionString, max: 10 });
export const db = drizzle(pool, { schema });

export type DB = typeof db;
