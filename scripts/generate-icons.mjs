import sharp from "sharp";

const source = "public/cpipos-logo.png";
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

const sizes = [
  [16, "public/favicon-16x16.png"],
  [32, "public/favicon-32x32.png"],
  [48, "public/favicon-48x48.png"],
  [180, "public/apple-touch-icon.png"],
  [192, "public/pwa-icon-192.png"],
  [512, "public/pwa-icon-512.png"]
];

for (const [size, output] of sizes) {
  await sharp(source)
    .resize(size, size, { fit: "contain", background: transparent })
    .png()
    .toFile(output);
}

const maskableLogo = await sharp(source)
  .resize(310, 310, { fit: "contain", background: transparent })
  .png()
  .toBuffer();

await sharp({
  create: {
    width: 512,
    height: 512,
    channels: 4,
    background: "#0b294d"
  }
})
  .composite([{ input: maskableLogo, gravity: "center" }])
  .png()
  .toFile("public/pwa-maskable-512.png");

console.log("Generated CpiPOS favicon and PWA icon set.");
