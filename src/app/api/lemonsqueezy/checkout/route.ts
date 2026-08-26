import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { lemonSqueezySetup, createCheckout } from "@lemonsqueezy/lemonsqueezy.js";
import { withPaymentRateLimit } from "@/lib/security";

lemonSqueezySetup({ apiKey: process.env.LEMONSQUEEZY_API_KEY || "" });

const STORE_ID = process.env.LEMONSQUEEZY_STORE_ID || "";

// Variant IDs defined server-side — NEVER trusted from client input
const PLAN_VARIANT_MAP: Record<string, string> = {
    lite: process.env.LEMONSQUEEZY_LITE_VARIANT_ID || "",
    pro: process.env.LEMONSQUEEZY_PRO_VARIANT_ID || "",
    lifetime: process.env.LEMONSQUEEZY_LIFETIME_VARIANT_ID || "",
};

export async function POST(req: NextRequest) {
    try {
        // ── 1. Auth check ─────────────────────────────────────────────────────
        const session = await auth();
        if (!session?.user?.id || !session?.user?.email) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const userId = session.user.id;

        // ── 2. Rate limiting — max 3 checkout attempts per minute ─────────────
        const allowed = await withPaymentRateLimit(userId);
        if (!allowed) {
            return new NextResponse("Too many requests. Please wait before trying again.", { status: 429 });
        }

        // ── 3. Parse and strictly validate plan ───────────────────────────────
        const body = await req.json();
        const { plan } = body;

        if (!plan || !(plan in PLAN_VARIANT_MAP)) {
            return new NextResponse("Invalid plan selected", { status: 400 });
        }

        const variantId = PLAN_VARIANT_MAP[plan];

        if (!variantId || !STORE_ID) {
            console.error("[LS_CHECKOUT] Missing environment variables — gateway not configured");
            return new NextResponse("Payment gateway not configured", { status: 500 });
        }

        const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard`;

        // ── 4. Create the Lemon Squeezy checkout ─────────────────────────────
        const { data, error } = await createCheckout(STORE_ID, variantId, {
            checkoutOptions: {
                embed: false,
                media: true,
                logo: true,
            },
            checkoutData: {
                email: session.user.email,
                custom: {
                    user_id: userId,
                    plan: plan,
                },
            },
            productOptions: {
                enabledVariants: [parseInt(variantId)],
                redirectUrl: `${returnUrl}?success=true`,
                receiptButtonText: "Go to Dashboard",
                receiptThankYouNote: "Thank you for upgrading! Your credits have been added.",
            },
            expiresAt: null,
        });

        if (error || !data?.data?.attributes?.url) {
            console.error("[LS_CHECKOUT_ERROR]", error);
            return new NextResponse("Failed to create checkout session", { status: 500 });
        }

        return NextResponse.json({ url: data.data.attributes.url });

    } catch (err) {
        console.error("[LS_CHECKOUT_ERROR]", err);
        // Never expose internal error details to the client
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
