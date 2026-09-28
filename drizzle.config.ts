import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";

// drizzle-kit reads .env by default — load .env.local for local dev
dotenv.config({ path: ".env.local" });

export default {
    schema: "./src/db/schema.ts",
    out: "./drizzle",
    dialect: "postgresql",
    dbCredentials: {
        url: process.env.DATABASE_URL!,
    },
} satisfies Config;
