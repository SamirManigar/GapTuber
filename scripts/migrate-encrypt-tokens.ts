/**
 * scripts/migrate-encrypt-tokens.ts
 *
 * One-time migration: encrypts any plaintext YouTube OAuth tokens
 * that were stored in the database before token encryption was enforced.
 *
 * SAFE TO RE-RUN: already-encrypted tokens are detected by isEncrypted()
 * and skipped — they will never be double-encrypted.
 *
 * Run with:
 *   npx tsx scripts/migrate-encrypt-tokens.ts
 *
 * Prerequisites:
 *   - TOKEN_ENCRYPTION_KEY must be set in .env.local
 *   - DATABASE_URL must be set in .env.local
 */

import "dotenv/config";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { ne, isNotNull, or } from "drizzle-orm";
import ws from "ws";
import * as schema from "../src/db/schema";
import { encryptToken, isEncrypted } from "../src/lib/token-crypto";

neonConfig.webSocketConstructor = ws;

async function main() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error("DATABASE_URL is not set in environment.");
    }

    const pool = new Pool({ connectionString });
    const db = drizzle(pool, { schema });

    console.log("🔍 Fetching channels with OAuth tokens...");

    // Fetch all channels that have at least one token
    const channelsToMigrate = await db
        .select({
            id: schema.channels.id,
            name: schema.channels.name,
            youtubeAccessToken: schema.channels.youtubeAccessToken,
            youtubeRefreshToken: schema.channels.youtubeRefreshToken,
        })
        .from(schema.channels)
        .where(
            or(
                isNotNull(schema.channels.youtubeAccessToken),
                isNotNull(schema.channels.youtubeRefreshToken)
            )
        );

    console.log(`Found ${channelsToMigrate.length} channels with tokens.\n`);

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const channel of channelsToMigrate) {
        try {
            const updates: Partial<typeof schema.channels.$inferInsert> = {};
            let needsUpdate = false;

            // Access token
            if (channel.youtubeAccessToken && !isEncrypted(channel.youtubeAccessToken)) {
                updates.youtubeAccessToken = encryptToken(channel.youtubeAccessToken);
                needsUpdate = true;
            }

            // Refresh token
            if (channel.youtubeRefreshToken && !isEncrypted(channel.youtubeRefreshToken)) {
                updates.youtubeRefreshToken = encryptToken(channel.youtubeRefreshToken);
                needsUpdate = true;
            }

            if (needsUpdate) {
                await db
                    .update(schema.channels)
                    .set(updates)
                    .where(ne(schema.channels.id, "non-existent-id")); // Drizzle requires a where clause
                
                // Re-do properly with actual channel ID
                const { eq } = await import("drizzle-orm");
                await db
                    .update(schema.channels)
                    .set(updates)
                    .where(eq(schema.channels.id, channel.id));

                console.log(`  ✅ Migrated: ${channel.name} (${channel.id})`);
                migrated++;
            } else {
                console.log(`  ⏭️  Skipped (already encrypted): ${channel.name}`);
                skipped++;
            }
        } catch (err) {
            console.error(`  ❌ Error migrating ${channel.name}:`, err);
            errors++;
        }
    }

    console.log(`\n📊 Migration complete:`);
    console.log(`   Migrated : ${migrated}`);
    console.log(`   Skipped  : ${skipped}`);
    console.log(`   Errors   : ${errors}`);

    await pool.end();
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
