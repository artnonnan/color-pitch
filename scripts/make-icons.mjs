// Generates PNG app icons (no dependencies): a ring of the 7 default note colors.
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";

const COLORS = ["#ef4444", "#f97316", "#facc15", "#22c55e", "#38bdf8", "#3b5bf6", "#a855f7"].map((h) => [
  parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16),
]);
const BG = [11, 11, 18];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, { maskable = false } = {}) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const cx = size / 2, cy = size / 2;
  const scale = maskable ? 0.72 : 0.92; // maskable icons keep content in the safe zone
  const outer = (size / 2) * scale, inner = outer * 0.52;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      // 4x supersampling for smooth edges
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) {
        const dx = x + (sx + 0.5) / 2 - cx, dy = y + (sy + 0.5) / 2 - cy;
        const d = Math.hypot(dx, dy);
        let col = BG;
        if (d <= outer && d >= inner) {
          const ang = (Math.atan2(dx, -dy) / (2 * Math.PI) + 1) % 1;
          const f = ang * 7, i = Math.floor(f), tt = f - i;
          const A = COLORS[i], B = COLORS[(i + 1) % 7];
          col = A.map((v, k) => v + (B[k] - v) * tt);
        } else if (d < inner * 0.42) {
          col = [243, 241, 248];
        }
        r += col[0]; g += col[1]; b += col[2];
      }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r / 4; raw[o + 1] = g / 4; raw[o + 2] = b / 4; raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon-192.png", png(192));
writeFileSync("public/icons/icon-512.png", png(512));
writeFileSync("public/icons/icon-maskable-512.png", png(512, { maskable: true }));
writeFileSync("public/icons/apple-touch-icon.png", png(180, { maskable: true }));
writeFileSync("app/favicon.ico", png(48)); // PNG-in-ICO is accepted by all modern browsers
console.log("icons written");
