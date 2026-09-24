import sharp from "sharp";
import fs from "node:fs/promises";
await fs.mkdir("public/icons", { recursive: true });
for (const size of [180, 192, 512])
  await sharp("public/icon.svg")
    .resize(size, size)
    .png()
    .toFile(`public/icons/icon-${size}.png`);
await sharp({
  create: { width: 512, height: 512, channels: 4, background: "#2878ed" },
})
  .composite([
    {
      input: await sharp("public/icon.svg").resize(360, 360).png().toBuffer(),
      gravity: "center",
    },
  ])
  .png()
  .toFile("public/icons/maskable-512.png");
