import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders, optionsResponse } from "@/lib/cors";
import { resolveUserFromRequest } from "@/lib/resolve-user";

export async function OPTIONS(req: NextRequest) {
    return optionsResponse(req);
}

export async function GET(req: NextRequest) {
    const cors = getCorsHeaders(req);
    const user = await resolveUserFromRequest(req);
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: cors });
    }

    return NextResponse.json({ credits: user.credits }, { headers: cors });
}
