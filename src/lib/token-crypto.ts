/**
 * AES-256-GCM encryption for sensitive DB fields (YouTube OAuth tokens).
 *
 * Requires: TOKEN_ENCRYPTION_KEY env var — a 64-char hex string (32 bytes).
 * Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * Usage:
 *   // Before writing to DB:
 *   const encrypted = encryptToken(accessToken);
 *   // Before using from DB:
 *   const plain = decryptToken(encryptedValue);
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { env } from "@/env";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;   // 96-bit IV — GCM standard
const TAG_BYTES = 16;  // 128-bit auth tag

function getKey(): Buffer {
    const hex = env.TOKEN_ENCRYPTION_KEY;
    if (!hex || hex.length !== 64) {
        throw new Error(
            "TOKEN_ENCRYPTION_KEY is not set or invalid. " +
            "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
        );
    }
    return Buffer.from(hex, "hex");
}

/**
 * Encrypts a plain-text token.
 * Returns a base64-encoded string: iv(12) + ciphertext + authTag(16)
 */
export function encryptToken(plain: string): string {
    const key = getKey();
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Pack: iv | ciphertext | authTag
    return Buffer.concat([iv, encrypted, authTag]).toString("base64");
}

/**
 * Decrypts a token encrypted by encryptToken().
 * Returns null if decryption fails (e.g. wrong key, tampered data).
 */
export function decryptToken(packed: string): string | null {
    try {
        const key = getKey();
        const buf = Buffer.from(packed, "base64");

        const iv = buf.subarray(0, IV_BYTES);
        const authTag = buf.subarray(buf.length - TAG_BYTES);
        const ciphertext = buf.subarray(IV_BYTES, buf.length - TAG_BYTES);

        const decipher = createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    } catch {
        return null; // Invalid key, tampered data, or pre-encryption legacy token
    }
}

/**
 * Checks whether a stored token value appears to be encrypted (base64 packed)
 * vs a legacy plaintext token that starts with "ya29." (Google access token).
 * Used for backwards-compatible migration.
 */
export function isEncrypted(value: string): boolean {
    return !value.startsWith("ya29.") && !value.startsWith("1//");
}
