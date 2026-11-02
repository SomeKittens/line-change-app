// Generates the PWA icons (a puck with a green change arrow ring) as PNGs, no dependencies.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};

function icon(size, { padding }) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const c = size / 2;
  const r = (size / 2) * (1 - padding);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c) / r;
      // background #111, green ring #4cd964, puck #000 with a subtle #333 rim
      let col = [0x11, 0x11, 0x11];
      if (d < 1.0 && d >= 0.82) col = [0x4c, 0xd9, 0x64];
      else if (d < 0.82 && d >= 0.62) col = [0x11, 0x11, 0x11];
      else if (d < 0.62 && d >= 0.56) col = [0x33, 0x33, 0x33];
      else if (d < 0.56) col = [0x00, 0x00, 0x00];
      const i = y * (size * 4 + 1) + 1 + x * 4;
      raw[i] = col[0]; raw[i + 1] = col[1]; raw[i + 2] = col[2]; raw[i + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

writeFileSync('public/icons/icon-192.png', icon(192, { padding: 0.08 }));
writeFileSync('public/icons/icon-512.png', icon(512, { padding: 0.08 }));
writeFileSync('public/icons/icon-maskable-512.png', icon(512, { padding: 0.3 }));
writeFileSync('public/icons/apple-touch-icon.png', icon(180, { padding: 0.12 }));
