import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Crisp modern SVG icon with glowing amber/gold star and 'N' monogram on dark slate
const svgIcon = `
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="112" fill="#0F172A"/>
  <circle cx="256" cy="256" r="180" fill="url(#bgGrad)" opacity="0.15"/>
  
  <!-- Outer Glow Ring -->
  <circle cx="256" cy="256" r="170" stroke="url(#amberGlow)" stroke-width="6" stroke-dasharray="16 12" opacity="0.6"/>
  
  <!-- Modern N Monogram Geometry -->
  <path d="M160 360V152H210L302 296V152H352V360H302L210 216V360H160Z" fill="url(#goldGrad)"/>
  
  <!-- Glowing AI Sparkle Star -->
  <g transform="translate(340, 120)">
    <path d="M0 24C13.25 24 24 13.25 24 0C24 13.25 34.75 24 48 24C34.75 24 24 34.75 24 48C24 34.75 13.25 24 0 24Z" fill="#F59E0B" filter="url(#glowFilter)"/>
    <path d="M0 24C13.25 24 24 13.25 24 0C24 13.25 34.75 24 48 24C34.75 24 24 34.75 24 48C24 34.75 13.25 24 0 24Z" fill="#FDE68A"/>
  </g>

  <defs>
    <linearGradient id="bgGrad" x1="76" y1="76" x2="436" y2="436" gradientUnits="userSpaceOnUse">
      <stop stop-color="#F59E0B"/>
      <stop offset="1" stop-color="#D97706"/>
    </linearGradient>
    <linearGradient id="amberGlow" x1="86" y1="86" x2="426" y2="426" gradientUnits="userSpaceOnUse">
      <stop stop-color="#F59E0B"/>
      <stop offset="0.5" stop-color="#FBBF24"/>
      <stop offset="1" stop-color="#B45309"/>
    </linearGradient>
    <linearGradient id="goldGrad" x1="160" y1="152" x2="352" y2="360" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FFFFFF"/>
      <stop offset="0.3" stop-color="#FEF3C7"/>
      <stop offset="0.7" stop-color="#FDE68A"/>
      <stop offset="1" stop-color="#F59E0B"/>
    </linearGradient>
    <filter id="glowFilter" x="-10" y="-10" width="68" height="68" filterUnits="userSpaceOnUse">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>
</svg>
`;

fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgIcon.trim());

async function generateIcons() {
  const svgBuffer = Buffer.from(svgIcon);

  // 512x512 standard icon
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'icon-512.png'));

  // 192x192 standard icon
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'icon-192.png'));

  // Apple touch icon (180x180)
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));

  // Maskable icons with slight padding
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'icon-maskable-512.png'));

  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'icon-maskable-192.png'));

  // Favicon (32x32 & 48x48)
  await sharp(svgBuffer)
    .resize(48, 48)
    .png()
    .toFile(path.join(publicDir, 'favicon.png'));

  console.log('✅ All PWA Icons generated successfully in public/');
}

generateIcons().catch(console.error);
