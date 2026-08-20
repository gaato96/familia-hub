import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

/**
 * Genera los íconos de la PWA desde un SVG en línea.
 *
 * Sin archivo fuente a propósito: el ícono es una casa sobre el violeta de la
 * app, y tenerlo como código evita que se pierda un .png suelto o que quede
 * desincronizado con la paleta de globals.css.
 *
 * El maskable lleva la casa MÁS CHICA (60% en vez de 72%): Android recorta el
 * ícono a la forma del launcher — círculo, squircle, gota — y todo lo que
 * quede fuera de la "safe zone" central se pierde. Un maskable dibujado al
 * mismo tamaño que el normal aparece con la casa decapitada.
 */

const BACKGROUND = "#6D4AFF";

function houseSvg(size: number, scale: number): string {
  const inner = size * scale;
  const offset = (size - inner) / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BACKGROUND}"/>
  <g transform="translate(${offset} ${offset}) scale(${inner / 24})">
    <path d="M3 10.5 12 3l9 7.5" fill="none" stroke="#fff" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M5.5 9.5V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.5" fill="none" stroke="#fff"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M10 21v-5.5h4V21" fill="none" stroke="#fff" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;
}

const TARGETS = [
  { file: "icon-192.png", size: 192, scale: 0.72 },
  { file: "icon-512.png", size: 512, scale: 0.72 },
  { file: "maskable-512.png", size: 512, scale: 0.6 },
  { file: "badge-72.png", size: 72, scale: 0.8 },
  { file: "apple-touch-icon.png", size: 180, scale: 0.72 },
];

async function main() {
  const outDir = path.join(process.cwd(), "public", "icons");
  await mkdir(outDir, { recursive: true });

  for (const { file, size, scale } of TARGETS) {
    const png = await sharp(Buffer.from(houseSvg(size, scale))).png().toBuffer();
    await writeFile(path.join(outDir, file), png);
    console.log(`  ${file} (${size}x${size})`);
  }

  console.log(`\nListo: ${TARGETS.length} íconos en public/icons/`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
