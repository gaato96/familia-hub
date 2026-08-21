import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

/**
 * Genera los íconos de la PWA desde un SVG en línea.
 *
 * Sin archivo fuente a propósito: el ícono es el nido sobre la terracota de la
 * marca, y tenerlo como código evita que se pierda un .png suelto o que quede
 * desincronizado con la paleta de globals.css. El mismo dibujo vive en
 * src/components/brand/logo.tsx — si cambia uno, cambia el otro.
 *
 * El maskable lleva el nido MÁS CHICO (58% en vez de 72%): Android recorta el
 * ícono a la forma del launcher — círculo, squircle, gota — y todo lo que
 * quede fuera de la "safe zone" central se pierde. Un maskable dibujado al
 * mismo tamaño que el normal aparece con los huevos cortados.
 */

/** --app-primary de globals.css. */
const BACKGROUND = "#9F4122";

function nestSvg(size: number, scale: number): string {
  const inner = size * scale;
  const offset = (size - inner) / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BACKGROUND}"/>
  <g transform="translate(${offset} ${offset}) scale(${inner / 24})">
    <path fill="#ffffff" fill-rule="evenodd"
          d="M2.4 13.2A9.6 5.4 0 0 1 21.6 13.2C21.6 17.7 17.3 21 12 21S2.4 17.7 2.4 13.2ZM12 9.75c-3.37 0-6.1 1.5-6.1 3.15S8.63 16.05 12 16.05s6.1-1.5 6.1-3.15S15.37 9.75 12 9.75Z"/>
    <g fill="#ffffff" opacity="0.82">
      <ellipse cx="9.25" cy="13.3" rx="1.3" ry="1.55"/>
      <ellipse cx="12" cy="12.3" rx="1.3" ry="1.55"/>
      <ellipse cx="14.75" cy="13.3" rx="1.3" ry="1.55"/>
    </g>
  </g>
</svg>`;
}

const TARGETS = [
  { file: "icon-192.png", size: 192, scale: 0.74 },
  { file: "icon-512.png", size: 512, scale: 0.74 },
  { file: "maskable-512.png", size: 512, scale: 0.58 },
  { file: "badge-72.png", size: 72, scale: 0.8 },
  { file: "apple-touch-icon.png", size: 180, scale: 0.74 },
];

async function main() {
  const outDir = path.join(process.cwd(), "public", "icons");
  await mkdir(outDir, { recursive: true });

  for (const { file, size, scale } of TARGETS) {
    const png = await sharp(Buffer.from(nestSvg(size, scale))).png().toBuffer();
    await writeFile(path.join(outDir, file), png);
    console.log(`  ${file} (${size}x${size})`);
  }

  console.log(`\nListo: ${TARGETS.length} íconos en public/icons/`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
