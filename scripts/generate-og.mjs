import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const inputUrl = new URL("../public/og-card.svg", import.meta.url);
const outputUrl = new URL("../public/og-card.png", import.meta.url);
const input = await fs.readFile(inputUrl);

await sharp(input, { density: 144 })
  .resize(1200, 630, { fit: "fill" })
  .png({ compressionLevel: 9, palette: true })
  .toFile(fileURLToPath(outputUrl));

console.log("Generated public/og-card.png");
