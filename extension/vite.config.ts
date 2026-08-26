import { defineConfig } from "vite";
import { resolve } from "path";
import { copyFileSync, mkdirSync, existsSync } from "fs";

// Inline plugin to copy static extension assets to dist
function copyExtensionAssets() {
    return {
        name: "copy-extension-assets",
        closeBundle() {
            // Copy manifest.json
            copyFileSync("manifest.json", "dist/manifest.json");

            // Copy icons if they exist
            const iconSizes = [16, 48, 128];
            if (existsSync("icons")) {
                mkdirSync("dist/icons", { recursive: true });
                for (const size of iconSizes) {
                    const src = `icons/icon${size}.png`;
                    if (existsSync(src)) {
                        copyFileSync(src, `dist/icons/icon${size}.png`);
                    }
                }
            }
        },
    };
}

export default defineConfig({
    plugins: [copyExtensionAssets()],
    build: {
        outDir: "dist",
        emptyOutDir: true,
        rollupOptions: {
            input: {
                sidebar: resolve(__dirname, "sidebar.html"),
                content: resolve(__dirname, "src/content/content.ts"),
                background: resolve(__dirname, "src/background/background.ts"),
            },
            output: {
                entryFileNames: (chunk) => {
                    // Keep predictable names for manifest references
                    if (chunk.name === "content") return "content.js";
                    if (chunk.name === "background") return "background.js";
                    if (chunk.name === "sidebar") return "sidebar.js";
                    return "[name].js";
                },
                chunkFileNames: "chunks/[name]-[hash].js",
                assetFileNames: "[name].[ext]",
                format: "esm",
            },
        },
        target: "chrome112",
        minify: false,
        sourcemap: false,
    },
});
