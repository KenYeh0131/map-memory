const sharp = require("sharp");
const path = require("path");

const input = path.join(__dirname, "../public/apple-touch-icon.png");

async function run() {
  await sharp(input)
    .resize(192, 192)
    .png()
    .toFile(path.join(__dirname, "../public/icon-192.png"));

  await sharp(input)
    .resize(512, 512)
    .png()
    .toFile(path.join(__dirname, "../public/icon-512.png"));

  await sharp(input)
    .resize(64, 64)
    .png()
    .toFile(path.join(__dirname, "../public/favicon.png"));

  console.log("PWA icons generated!");
}

run();