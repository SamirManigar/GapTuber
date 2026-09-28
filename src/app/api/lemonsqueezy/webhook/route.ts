import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/db";
import { users, creditHistory } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { safeCompare, isAlreadyProcessed, markAsProcessed } from "@/lib/security";


const WEBHOOK_SECRET = process.env.LEMONSQUEEZY_WEBHOOK_SECRET || "";
const LIFETIME_VARIANT_ID = process.env.LEMONSQUEEZY_LIFETIME_VARIANT_ID || "";
const PRO_VARIANT_ID = process.env.LEMONSQUEEZY_PRO_VARIANT_ID || "";
const LITE_VARIANT_ID = process.env.LEMONSQUEEZY_LITE_VARIANT_ID || "";

function verifySignature(payload: string, signature: string): boolean {
    try {
        const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET);
        const digest = hmac.update(payload).digest("hex");
        return safeCompare(digest, signature);
    } catch {
        return false;
    }
}

export async function POST(req: NextRequest) {
    // CRITICAL: Must read as text BEFORE any JSON parsing to preserve signature integrity
    const body = await req.text();
    const signature = req.headers.get("x-signature") || "";

    if (!WEBHOOK_SECRET || !signature) {
        return new NextResponse("Missing signature or secret", { status: 400 });
    }

    if (!verifySignature(body, signature)) {
        console.error("[LS_WEBHOOK] Invalid signature");
        return new NextResponse("Invalid signature", { status: 401 });
    }

    let event: any;
    try {
        event = JSON.parse(body);
    } catch {
        return new NextResponse("Invalid JSON", { status: 400 });
    }

    const eventName: string = event.meta?.event_name;
    // user_id is passed in checkoutData.custom during createCheckout
    const userId: string | undefined = event.meta?.custom_data?.user_id;

    const eventId: string = event.data?.id?.toString() || "";

    // ── Replay attack prevention ─────────────────────────────────────────────
    if (eventId && await isAlreadyProcessed(`ls:${eventId}`)) {
        console.warn(`[LS_WEBHOOK] Duplicate event ${eventId} — ignoring`);
        return new NextResponse("OK", { status: 200 });
    }

    if (!userId) {
        // Return 200 to avoid Lemon Squeezy retrying on test events with no user
        console.warn("[LS_WEBHOOK] No userId in custom_data, ignoring");
        return new NextResponse("OK", { status: 200 });
    }

    try {
        switch (eventName) {
            case "order_created": {
                // One-time purchases (Lifetime Deal) fire order_created
                const variantId = event.data?.attributes?.first_order_item?.variant_id?.toString();
                const orderId = event.data?.id?.toString();
                const customerId = event.data?.attributes?.customer_id?.toString();

                if (variantId === LIFETIME_VARIANT_ID) {
                    await db.update(users)
                        .set({
                            tier: "lifetime",
                            credits: sql`${users.credits} + 5000`,
                            lsCustomerId: customerId,
                            lsOrderId: orderId,
                        })
                        .where(eq(users.id, userId));

                    await db.insert(creditHistory).values({
                        userId,
                        amount: 5000,
                        action: "Purchased Pro Credit Pack (Lemon Squeezy)",
                    });
                }
                await markAsProcessed(`ls:${eventId}`);
                break;
            }

            case "subscription_created": {
                // Recurring subscriptions (Creator Pro) fire subscription_created
                const variantId = event.data?.attributes?.variant_id?.toString();
                const subscriptionId = event.data?.id?.toString();
                const customerId = event.data?.attributes?.customer_id?.toString();
                const status = event.data?.attributes?.status;

                if (variantId === PRO_VARIANT_ID && status === "active") {
                    await db.update(users)
                        .set({
                            tier: "pro",
                            credits: sql`${users.credits} + 500`,
                            lsCustomerId: customerId,
                            lsSubscriptionId: subscriptionId,
                        })
                        .where(eq(users.id, userId));

                    await db.insert(creditHistory).values({
                        userId,
                        amount: 500,
                        action: "Purchased Creator Pro Subscription (Lemon Squeezy)",
                    });
                } else if (variantId === LITE_VARIANT_ID && status === "active") {
                    await db.update(users)
                        .set({
                            tier: "lite",
                            credits: sql`${users.credits} + 100`,
                            lsCustomerId: customerId,
                            lsSubscriptionId: subscriptionId,
                        })
                        .where(eq(users.id, userId));

                    await db.insert(creditHistory).values({
                        userId,
                        amount: 100,
                        action: "Purchased Creator Lite Subscription (Lemon Squeezy)",
                    });
                }
                await markAsProcessed(`ls:${eventId}`);
                break;
            }

            case "subscription_updated": {
                // Handle renewals and plan changes
                const status = event.data?.attributes?.status;
                if (status === "active") {
                    // Renewal — keep tier as pro, no extra credits on renewal
                    console.log(`[LS_WEBHOOK] Subscription renewed for user ${userId}`);
                }
                break;
            }

            case "subscription_expired":
            case "subscription_cancelled": {
                // Downgrade user on cancellation/expiry
                await db.update(users)
                    .set({ tier: "free" })
                    .where(eq(users.id, userId));

                console.log(`[LS_WEBHOOK] Subscription ended for user ${userId}, downgraded to free`);
                break;
            }

            default:
                console.log(`[LS_WEBHOOK] Unhandled event: ${eventName}`);
        }
    } catch (err) {
        console.error("[LS_WEBHOOK_PROCESSING_ERROR]", err);
        // IMPORTANT: Return 200 to prevent Lemon Squeezy infinite retry loops.
        // Non-200 responses trigger automatic retries which can cause duplicate credit grants.
        return new NextResponse("OK", { status: 200 });
    }

    return new NextResponse("OK", { status: 200 });
}
