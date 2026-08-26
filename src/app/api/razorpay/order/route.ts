import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import Razorpay from "razorpay";
import { withPaymentRateLimit, getCachedOrder, cacheOrder } from "@/lib/security";

const razorpay = new Razorpay({
    key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "dummy",
    key_secret: process.env.RAZORPAY_KEY_SECRET || "dummy",
});

const PLAN_PRICES: Record<string, number> = {
    lite: 299 * 100,       // ₹299 in paise
    pro: 799 * 100,        // ₹799 in paise
    lifetime: 4999 * 100,  // ₹4,999 in paise (Pro Credit Pack)
};

export async function POST(req: NextRequest) {
    try {
        // ── 1. Auth check ─────────────────────────────────────────────────────
        const session = await auth();
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const userId = session.user.id;

        // ── 2. Rate limiting — max 3 checkout attempts per minute ─────────────
        const allowed = await withPaymentRateLimit(userId);
        if (!allowed) {
            return new NextResponse("Too many requests. Please wait before trying again.", { status: 429 });
        }

        // ── 3. Parse and strictly validate plan (never trust client for price) ─
        const body = await req.json();
        const { plan } = body;

        if (!plan || !(plan in PLAN_PRICES)) {
            return new NextResponse("Invalid plan selected", { status: 400 });
        }

        const amountINR = PLAN_PRICES[plan];

        // ── 4. Idempotency — if user just created this order, return cached one ─
        const cached = await getCachedOrder(userId, plan);
        if (cached) {
            console.log(`[RAZORPAY_ORDER] Returning cached order ${cached} for user ${userId}`);
            return NextResponse.json({
                id: cached,
                currency: "INR",
                amount: amountINR,
            });
        }

        // ── 5. Create the Razorpay order ──────────────────────────────────────
        const order = await razorpay.orders.create({
            amount: amountINR,
            currency: "INR",
            receipt: `rcpt_${userId.slice(0, 8)}_${Date.now()}`,
            notes: {
                userId,
                plan,
            },
        });

        // ── 6. Cache the order ID to prevent duplicate orders ─────────────────
        await cacheOrder(userId, plan, order.id as string);

        return NextResponse.json({
            id: order.id,
            currency: order.currency,
            amount: order.amount,
        });

    } catch (err) {
        console.error("[RAZORPAY_ORDER_ERROR]", err);
        // Never expose internal error details to the client
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
