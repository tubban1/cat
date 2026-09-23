import fs from "node:fs/promises";
import sharp from "sharp";

const input = await fs.readFile(new URL("../public/og-card.svg", import.meta.url));
await sharp(input, { density: 144 })
  .resize(1200, 630, { fit: "fill" })
  .png({ compressionLevel: 9, palette: true })
  .toFile(new URL("../public/og-card.png", import.meta.url));

console.log("Generated public/og-card.png");
