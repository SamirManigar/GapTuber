// Generates extension PNG icons from logo.svg using sharp
import sharp from "sharp";
import { readFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const svgPath = join(projectRoot, "public", "logo.svg");
const iconsDir = join(projectRoot, "..", "extension", "icons");
const distIconsDir = join(projectRoot, "..", "extension", "dist", "icons");

mkdirSync(iconsDir, { recursive: true });
mkdirSync(distIconsDir, { recursive: true });

const svgContent = readFileSync(svgPath);
const sizes = [16, 48, 128];

// The SVG has viewBox="86 60 298 392" — we need to render it cleanly.
// Build a wrapper that sets an explicit white-round background + the original paths.
const wrappedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <!-- Dark background circle -->
  <rect width="512" height="512" rx="100" fill="#0a0a0f"/>
  <!-- Scale and center the original logo (viewBox 86 60 298 392 → center in 512x512) -->
  <g transform="translate(256,256) scale(1.35) translate(-241,-256)">
    <!-- Outer White Hexagon C outline -->
    <path d="M 370 142 L 256 76 L 100 166 L 100 346 L 256 436 L 370 370"
          fill="none" stroke="#ffffff" stroke-width="28" stroke-linecap="butt" stroke-linejoin="miter"/>
    <!-- Inner Emerald Hexagon C track -->
    <path d="M 330 185 L 256 142 L 156 200 L 156 312 L 256 370 L 330 327"
          fill="none" stroke="#10b981" stroke-width="28" stroke-linecap="butt" stroke-linejoin="miter"/>
    <!-- Solid Emerald Play Button Triangle -->
    <polygon points="240,256 370,180 370,332" fill="#10b981"/>
  </g>
</svg>`;

const svgBuf = Buffer.from(wrappedSvg);

for (const size of sizes) {
  const outPath = join(iconsDir, `icon${size}.png`);
  const distPath = join(distIconsDir, `icon${size}.png`);
  await sharp(svgBuf)
    .resize(size, size)
    .png()
    .toFile(outPath);
  await sharp(svgBuf)
    .resize(size, size)
    .png()
    .toFile(distPath);
  console.log(`✅ Generated icon${size}.png → ${outPath}`);
  console.log(`✅ Generated icon${size}.png → ${distPath}`);
}

// Also update the auraiq-logo.png in the icons folder if it exists
const auraiqPath = join(iconsDir, "auraiq-logo.png");
await sharp(svgBuf).resize(128, 128).png().toFile(auraiqPath);
console.log("✅ Updated auraiq-logo.png → " + auraiqPath);

console.log("\n🎉 All icons generated successfully!");
