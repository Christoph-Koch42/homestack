// One-off script to generate the PWA icons (no image lib available in this env).
// Builds raw PNGs by hand: pixel buffer -> zlib-compressed scanlines -> PNG chunks.
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];
const RED = [255, 48, 0]; // Swiss red

// HomeStack mark: a stack of geometry (same as src/ui/Composition.tsx).
function makeIcon(size) {
  const px = new Uint8Array(size * size * 4);
  const set = (x, y, [r, g, b]) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
    px[i + 3] = 255;
  };
  const s = size / 100;
  const fillRect = (x0, y0, x1, y1, color) => {
    for (let y = Math.round(y0 * s); y < Math.round(y1 * s); y++)
      for (let x = Math.round(x0 * s); x < Math.round(x1 * s); x++) set(x, y, color);
  };
  const fillCircle = (cx, cy, r, color) => {
    for (let y = -r * s; y <= r * s; y++)
      for (let x = -r * s; x <= r * s; x++)
        if (x * x + y * y <= r * r * s * s) set(Math.round(cx * s + x), Math.round(cy * s + y), color);
  };

  // Content kept inside the central 80% so the maskable crop never cuts it.
  fillRect(0, 0, 100, 100, WHITE);
  fillRect(18, 60, 64, 82, BLACK); // base block
  fillRect(28, 38, 64, 56, BLACK); // outlined block...
  fillRect(32, 42, 60, 52, WHITE);
  fillCircle(64, 38, 16, RED); // red circle on top
  fillRect(18, 85, 82, 88, BLACK); // ground line
  return px;
}

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(px, size) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter type: none
    px.slice(y * size * 4, (y + 1) * size * 4).forEach((v, i) => {
      raw[y * (size * 4 + 1) + 1 + i] = v;
    });
  }
  const idatData = zlib.deflateSync(raw);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idatData),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });

for (const size of [192, 512]) {
  const png = encodePNG(makeIcon(size), size);
  fs.writeFileSync(path.join(outDir, `icon-${size}.png`), png);
  console.log(`wrote icon-${size}.png`);
}
