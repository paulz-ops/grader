// Erzeugt die App-Icons (PNG) ohne externe Abhängigkeiten.
// Aufruf: node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const BG = [0x1f, 0x5f, 0x99];
const FG = [0xff, 0xff, 0xff];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  const S = 4; // Supersampling für glatte Kanten
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let acc = [0, 0, 0, 0];
      for (let sy = 0; sy < S; sy++)
        for (let sx = 0; sx < S; sx++) {
          const p = pixel((x + (sx + 0.5) / S) / size, (y + (sy + 0.5) / S) / size);
          for (let i = 0; i < 4; i++) acc[i] += p[i];
        }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      for (let i = 0; i < 4; i++) raw[o + i] = Math.round(acc[i] / (S * S));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function inRoundRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const dx = Math.max(x0 + r - x, 0, x - (x1 - r));
  const dy = Math.max(y0 + r - y, 0, y - (y1 - r));
  return Math.hypot(dx, dy) <= r;
}

/** Motiv: drei steigende Balken auf einer Grundlinie, scale = Anteil der Kantenlänge */
function isMotif(u, v, scale) {
  const x = (u - 0.5) / scale + 0.5;
  const y = (v - 0.5) / scale + 0.5;
  const bars = [
    [0.1, 0.55],
    [0.38, 0.35],
    [0.66, 0.12],
  ];
  const w = 0.24;
  const bottom = 0.84;
  const isBar = bars.some(([x0, top]) => inRoundRect(x, y, x0, top, x0 + w, bottom, 0.05));
  const base = inRoundRect(x, y, 0.06, 0.88, 0.94, 0.95, 0.035);
  return isBar || base;
}

function roundedInside(u, v, radius) {
  const dx = Math.max(radius - u, 0, u - (1 - radius));
  const dy = Math.max(radius - v, 0, v - (1 - radius));
  return Math.hypot(dx, dy) <= radius;
}

const icon = ({ rounded, scale }) => (u, v) => {
  if (rounded && !roundedInside(u, v, 0.2)) return [0, 0, 0, 0];
  return isMotif(u, v, scale) ? [...FG, 255] : [...BG, 255];
};

mkdirSync('public', { recursive: true });
writeFileSync('public/icon-192.png', png(192, icon({ rounded: true, scale: 0.62 })));
writeFileSync('public/icon-512.png', png(512, icon({ rounded: true, scale: 0.62 })));
// maskable: vollflächig, Motiv im sicheren Bereich (innere 60 %)
writeFileSync('public/icon-maskable-512.png', png(512, icon({ rounded: false, scale: 0.5 })));
// iOS rundet selbst ab
writeFileSync('public/apple-touch-icon.png', png(180, icon({ rounded: false, scale: 0.6 })));
console.log('Icons erzeugt in public/');
