const sharp = require('sharp');
const path = require('path');

async function createIcon() {
  const inputPath = path.join(__dirname, 'assets', 'icon-raw.jpg');
  const outputPath = path.join(__dirname, 'assets', 'icon-win.png');
  
  await sharp(inputPath)
    .resize(512, 512, {
      fit: 'cover',
      position: 'center'
    })
    .png()
    .toFile(outputPath);
  
  console.log('Created icon-win.png (512x512)');
}

createIcon().catch(console.error);
