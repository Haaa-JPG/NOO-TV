const sharp = require('sharp')
const path = require('path')

async function generateIcons() {
  const sizes = [72, 96, 128, 144, 152, 192, 384, 512]
  const iconsDir = path.join(__dirname, 'public', 'icons')

  // Create SVG icon - Red background with white "N" letter
  const svgIcon = `
    <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" fill="#dc2626" rx="80"/>
      <text x="256" y="340" font-family="Arial, sans-serif" font-size="300" font-weight="bold" fill="white" text-anchor="middle">N</text>
    </svg>
  `

  for (const size of sizes) {
    const filePath = path.join(iconsDir, `icon-${size}x${size}.png`)
    await sharp(Buffer.from(svgIcon))
      .resize(size, size)
      .png()
      .toFile(filePath)
    console.log(`Created icon-${size}x${size}.png`)
  }

  // Also create favicon
  const faviconPath = path.join(__dirname, 'public', 'favicon.ico')
  await sharp(Buffer.from(svgIcon))
    .resize(64, 64)
    .png()
    .toFile(faviconPath.replace('.ico', '.png'))
  console.log('Created favicon.png')
}

generateIcons().catch(console.error)
