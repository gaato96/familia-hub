import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

/**
 * Genera los íconos de la PWA desde un SVG en línea.
 *
 * Sin archivo fuente a propósito: el ícono es el nido del hornero sobre la
 * terracota de la marca, y tenerlo como código evita que se pierda un .png
 * suelto o que quede desincronizado con la paleta de globals.css. El mismo
 * path vive en src/components/brand/logo.tsx.
 *
 * El maskable lleva el nido MÁS CHICO (60% en vez de 72%): Android recorta el
 * ícono a la forma del launcher — círculo, squircle, gota — y todo lo que
 * quede fuera de la "safe zone" central se pierde. Un maskable dibujado al
 * mismo tamaño que el normal aparece decapitado.
 */

/** --app-primary de globals.css. */
const BACKGROUND = "#9F4122";

function nestSvg(size: number, scale: number): string {
  const inner = size * scale;
  const offset = (size - inner) / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BACKGROUND}"/>
  <g transform="translate(${offset} ${offset}) scale(${inner / 24})">
    <path fill="#fff" fill-rule="evenodd" clip-rule="evenodd"
          d="M12 3a8.5 8.5 0 0 1 8.5 8.5V19a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1v-7.5A8.5 8.5 0 0 1 12 3Zm2.75 9.25A3.25 3.25 0 0 0 11.5 15.5V20h6.5v-4.5a3.25 3.25 0 0 0-3.25-3.25Z"/>
    <path fill="#fff" fill-opacity="0.45"
          d="M2.75 20.5h18.5a.9.9 0 0 1 0 1.8H2.75a.9.9 0 0 1 0-1.8Z"/>
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
