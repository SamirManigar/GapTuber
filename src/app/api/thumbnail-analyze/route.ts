import { NextResponse } from "next/server";

// Thumbnail analysis — coming soon
// This stub prevents a TypeScript type resolution error from the empty directory.
export async function POST() {
    return NextResponse.json(
        { error: "Thumbnail analysis is not yet implemented." },
        { status: 501 }
    );
}
