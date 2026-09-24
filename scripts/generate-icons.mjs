import sharp from "sharp";
import fs from "node:fs/promises";
await fs.mkdir("public/icons", { recursive: true });
const source = "public/branding/train-logo-shadow-v2.png";
for (const size of [32, 96, 180, 192, 512])
  await sharp(source)
    .resize(size, size)
    .flatten({ background: "#2878ed" })
    .png()
    .toFile(`public/icons/train-shadow-${size}.png`);
await sharp({
  create: { width: 512, height: 512, channels: 4, background: "#2878ed" },
})
  .composite([
    {
      input: await sharp(source).resize(360, 360).png().toBuffer(),
      gravity: "center",
    },
  ])
  .png()
  .toFile("public/icons/train-shadow-maskable-512.png");
