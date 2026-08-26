import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/db";
import { users, creditHistory } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { safeCompare, isAlreadyProcessed, markAsProcessed } from "@/lib/security";

const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "";

export async function POST(req: NextRequest) {
    // CRITICAL: Read as raw text — JSON parsing changes whitespace and breaks HMAC
    const bodyText = await req.text();
    const signature = req.headers.get("x-razorpay-signature") || "";

    // ── 1. Reject if secrets are missing ─────────────────────────────────────
    if (!webhookSecret || !signature) {
        // Always return 200 to Razorpay — non-200 causes infinite retries
        console.error("[RAZORPAY_WEBHOOK] Missing secret or signature");
        return new NextResponse("OK", { status: 200 });
    }

    // ── 2. Verify signature using timing-safe comparison ─────────────────────
    const expectedSig = crypto
        .createHmac("sha256", webhookSecret)
        .update(bodyText)
        .digest("hex");

    if (!safeCompare(expectedSig, signature)) {
        console.error("[RAZORPAY_WEBHOOK] Signature mismatch — possible forgery attempt");
        return new NextResponse("OK", { status: 200 });
    }

    let body: any;
    try {
        body = JSON.parse(bodyText);
    } catch {
        console.error("[RAZORPAY_WEBHOOK] Invalid JSON body");
        return new NextResponse("OK", { status: 200 });
    }

    try {
        if (body.event === "order.paid") {
            const order = body.payload?.order?.entity;
            const payment = body.payload?.payment?.entity;

            if (!order || !payment) {
                console.error("[RAZORPAY_WEBHOOK] Missing order or payment in payload");
                return new NextResponse("OK", { status: 200 });
            }

            const orderId: string = order.id;
            const userId: string | undefined = order.notes?.userId;
            const plan: string | undefined = order.notes?.plan;

            if (!userId || !orderId) {
                console.error("[RAZORPAY_WEBHOOK] Missing userId or orderId");
                return new NextResponse("OK", { status: 200 });
            }

            // ── 3. Replay attack prevention ───────────────────────────────────
            // If this exact orderId was already processed, silently acknowledge
            // and exit WITHOUT granting credits again
            if (await isAlreadyProcessed(`razorpay:${orderId}`)) {
                console.warn(`[RAZORPAY_WEBHOOK] Duplicate event for orderId: ${orderId} — ignoring`);
                return new NextResponse("OK", { status: 200 });
            }

            // ── 4. Validate plan is a known value (prevent privilege escalation) ──
            if (plan !== "lite" && plan !== "pro" && plan !== "lifetime") {
                console.error(`[RAZORPAY_WEBHOOK] Unknown plan: ${plan}`);
                return new NextResponse("OK", { status: 200 });
            }

            // ── 5. Verify payment was actually captured (not just authorized) ──
            if (payment.status !== "captured") {
                console.warn(`[RAZORPAY_WEBHOOK] Payment not captured. Status: ${payment.status}`);
                return new NextResponse("OK", { status: 200 });
            }

            if (plan === "pro") {
                await db.update(users)
                    .set({
                        tier: "pro",
                        credits: sql`${users.credits} + 500`,
                        razorpayOrderId: orderId,
                    })
                    .where(eq(users.id, userId));

                await db.insert(creditHistory).values({
                    userId,
                    amount: 500,
                    action: "Purchased Creator Pro Subscription (Razorpay)",
                });

            } else if (plan === "lite") {
                await db.update(users)
                    .set({
                        tier: "lite",
                        credits: sql`${users.credits} + 100`,
                        razorpayOrderId: orderId,
                    })
                    .where(eq(users.id, userId));

                await db.insert(creditHistory).values({
                    userId,
                    amount: 100,
                    action: "Purchased Creator Lite Subscription (Razorpay)",
                });

            } else if (plan === "lifetime") {
                await db.update(users)
                    .set({
                        tier: "lifetime",
                        credits: sql`${users.credits} + 5000`,
                        razorpayOrderId: orderId,
                    })
                    .where(eq(users.id, userId));

                await db.insert(creditHistory).values({
                    userId,
                    amount: 5000,
                    action: "Purchased Pro Credit Pack (Razorpay)",
                });
            }

            // ── 6. Mark as processed AFTER successful DB write ────────────────
            await markAsProcessed(`razorpay:${orderId}`);
        }

        // ─────────────────────────────────────────────────────────────
        // Handle subscription lifecycle events (cancellation, halted)
        // ─────────────────────────────────────────────────────────────
        if (body.event === "subscription.halted" || body.event === "subscription.cancelled") {
            const subscription = body.payload?.subscription?.entity;
            const subUserId: string | undefined = subscription?.notes?.userId;

            if (subUserId) {
                await db.update(users)
                    .set({ tier: "free" })
                    .where(eq(users.id, subUserId));

                console.log(`[RAZORPAY_WEBHOOK] Subscription ended for user ${subUserId} (event: ${body.event}) — downgraded to free`);
            }
        }
    } catch (err) {
        // Log full error server-side only — never expose to client
        console.error("[RAZORPAY_WEBHOOK_PROCESSING_ERROR]", err);
        // Still return 200 to prevent Razorpay infinite retry loop
        return new NextResponse("OK", { status: 200 });
    }

    return new NextResponse("OK", { status: 200 });
}
