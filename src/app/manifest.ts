import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "GapTuber",
        short_name: "GapTuber",
        description: "YouTube Intelligence Suite for content gap detection.",
        start_url: "/dashboard",
        display: "standalone",
        background_color: "#0c0c0e",
        theme_color: "#111113",
        icons: [
            {
                src: "/apple-icon.png",
                sizes: "180x180",
                type: "image/png",
            },
        ],
    };
}
