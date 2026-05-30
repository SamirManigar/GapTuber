import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://gaptuber.app";

export default function sitemap(): MetadataRoute.Sitemap {
    return [
        {
            url: BASE,
            lastModified: new Date("2026-05-01"),
            changeFrequency: "monthly",
            priority: 1,
        },
        {
            url: `${BASE}/auth/signin`,
            lastModified: new Date("2026-05-01"),
            changeFrequency: "yearly",
            priority: 0.3,
        },
    ];
}
