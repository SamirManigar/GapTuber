import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/auth";
import { db } from "@/db";
import { users, creditHistory } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { safeCompare, isAlreadyProcessed, markAsProcessed } from "@/lib/security";

// Mirror of the price map in order/route.ts — must stay in sync
const PLAN_CREDITS: Record<string, { credits: number; tier?: "pro" | "lifetime" | "lite"; action: string }> = {
    lite:     { credits: 100,  tier: "lite",     action: "Purchased Creator Lite Subscription (Razorpay)" },
    pro:      { credits: 500,  tier: "pro",      action: "Purchased Creator Pro Subscription (Razorpay)" },
    lifetime: { credits: 5000, tier: "lifetime", action: "Purchased Pro Credit Pack (Razorpay)" },
};

export async function POST(req: NextRequest) {
    try {
        // ── 1. Auth check ─────────────────────────────────────────────────────
        const session = await auth();
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }
        const userId = session.user.id;

        // ── 2. Parse and validate body ────────────────────────────────────────
        let body: {
            razorpay_order_id?: string;
            razorpay_payment_id?: string;
            razorpay_signature?: string;
            plan?: string;
        };
        try {
            body = await req.json();
        } catch {
            return new NextResponse("Invalid request body", { status: 400 });
        }

        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return new NextResponse("Missing required payment fields", { status: 400 });
        }

        // ── 3. Verify HMAC-SHA256 signature ───────────────────────────────────
        // Algorithm: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
        const keySecret = process.env.RAZORPAY_KEY_SECRET;
        if (!keySecret) {
            console.error("[RAZORPAY_VERIFY] RAZORPAY_KEY_SECRET is not configured");
            return new NextResponse("Payment gateway not configured", { status: 500 });
        }

        const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
        const expectedSignature = crypto
            .createHmac("sha256", keySecret)
            .update(payload)
            .digest("hex");

        // Timing-safe comparison prevents byte-by-byte timing attacks
        if (!safeCompare(expectedSignature, razorpay_signature)) {
            console.error("[RAZORPAY_VERIFY] Signature mismatch — possible tampered response");
            return new NextResponse("Payment verification failed", { status: 400 });
        }

        // ── 4. Idempotency check — prevent double-grant ───────────────────────
        // The webhook also uses this same key. Whichever runs first (verify-payment
        // in dev, or webhook in production) marks it as processed; the other skips.
        const idempotencyKey = `razorpay:${razorpay_order_id}`;
        if (await isAlreadyProcessed(idempotencyKey)) {
            console.log(`[RAZORPAY_VERIFY] Order ${razorpay_order_id} already processed — skipping DB grant`);
            return NextResponse.json({ verified: true, credited: false, reason: "already_processed" });
        }

        // ── 5. Grant credits if plan is known ─────────────────────────────────
        const planKey = plan && plan in PLAN_CREDITS ? plan : null;

        if (planKey) {
            const { credits, tier, action } = PLAN_CREDITS[planKey];

            await db.update(users)
                .set({
                    ...(tier ? { tier } : {}),
                    credits: sql`${users.credits} + ${credits}`,
                    razorpayOrderId: razorpay_order_id,
                })
                .where(eq(users.id, userId));

            await db.insert(creditHistory).values({
                userId,
                amount: credits,
                action,
            });

            // Mark as processed so the webhook skips this order (no double-grant)
            await markAsProcessed(idempotencyKey);

            console.log(`[RAZORPAY_VERIFY] Granted ${credits} credits to user ${userId} for plan "${planKey}" (order: ${razorpay_order_id})`);
            return NextResponse.json({ verified: true, credited: true, credits });
        }

        // Signature valid but plan unknown — still return success (webhook will handle it)
        console.warn(`[RAZORPAY_VERIFY] Signature valid but unknown plan "${plan}" — deferring credit grant to webhook`);
        return NextResponse.json({ verified: true, credited: false, reason: "deferred_to_webhook" });

    } catch (err) {
        console.error("[RAZORPAY_VERIFY_ERROR]", err);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
