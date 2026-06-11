import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "../assets");
fs.mkdirSync(root, { recursive: true });

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let j = 0; j < 8; j += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(width, height, rgba) {
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    const start = y * width * 4;
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0;
    rgba.copy(row, 1, start, start + width * 4);
    rows.push(row);
  }
  const raw = Buffer.concat(rows);
  const compressed = zlib.deflateSync(raw);
  const header = Buffer.from("\x89PNG\r\n\x1a\n", "binary");
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([header, chunk("IHDR", ihdr), chunk("IDAT", compressed), chunk("IEND", Buffer.alloc(0))]);
}

function createCanvas(size) {
  return {
    size,
    data: Buffer.alloc(size * size * 4, 0),
  };
}

function setPixel(canvas, x, y, color) {
  if (x < 0 || y < 0 || x >= canvas.size || y >= canvas.size) return;
  const index = (y * canvas.size + x) * 4;
  canvas.data[index] = color[0];
  canvas.data[index + 1] = color[1];
  canvas.data[index + 2] = color[2];
  canvas.data[index + 3] = color[3];
}

function blendPixel(canvas, x, y, color) {
  if (x < 0 || y < 0 || x >= canvas.size || y >= canvas.size) return;
  const index = (y * canvas.size + x) * 4;
  const alpha = color[3] / 255;
  const inv = 1 - alpha;
  canvas.data[index] = Math.round(color[0] * alpha + canvas.data[index] * inv);
  canvas.data[index + 1] = Math.round(color[1] * alpha + canvas.data[index + 1] * inv);
  canvas.data[index + 2] = Math.round(color[2] * alpha + canvas.data[index + 2] * inv);
  canvas.data[index + 3] = Math.round(255 * (alpha + (canvas.data[index + 3] / 255) * inv));
}

function fillRoundedGradient(canvas, radius, startColor, endColor) {
  const size = canvas.size;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const inLeft = x >= radius || y >= radius || (x - radius) ** 2 + (y - radius) ** 2 <= radius ** 2;
      const inRight = x < size - radius || y >= radius || (x - (size - radius - 1)) ** 2 + (y - radius) ** 2 <= radius ** 2;
      const inBottomLeft = x >= radius || y < size - radius || (x - radius) ** 2 + (y - (size - radius - 1)) ** 2 <= radius ** 2;
      const inBottomRight = x < size - radius || y < size - radius || (x - (size - radius - 1)) ** 2 + (y - (size - radius - 1)) ** 2 <= radius ** 2;
      if (!(inLeft && inRight && inBottomLeft && inBottomRight)) continue;
      const t = (x + y) / (2 * (size - 1));
      const color = [
        Math.round(startColor[0] + (endColor[0] - startColor[0]) * t),
        Math.round(startColor[1] + (endColor[1] - startColor[1]) * t),
        Math.round(startColor[2] + (endColor[2] - startColor[2]) * t),
        255,
      ];
      setPixel(canvas, x, y, color);
    }
  }
}

function fillCircle(canvas, cx, cy, r, color) {
  const minX = Math.max(0, Math.floor(cx - r));
  const maxX = Math.min(canvas.size - 1, Math.ceil(cx + r));
  const minY = Math.max(0, Math.floor(cy - r));
  const maxY = Math.min(canvas.size - 1, Math.ceil(cy + r));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r ** 2) blendPixel(canvas, x, y, color);
    }
  }
}

function strokeEllipse(canvas, cx, cy, rx, ry, thickness, color) {
  const minX = Math.max(0, Math.floor(cx - rx - thickness));
  const maxX = Math.min(canvas.size - 1, Math.ceil(cx + rx + thickness));
  const minY = Math.max(0, Math.floor(cy - ry - thickness));
  const maxY = Math.min(canvas.size - 1, Math.ceil(cy + ry + thickness));
  const outerRx = rx + thickness / 2;
  const outerRy = ry + thickness / 2;
  const innerRx = Math.max(1, rx - thickness / 2);
  const innerRy = Math.max(1, ry - thickness / 2);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const outer = ((x - cx) ** 2) / (outerRx ** 2) + ((y - cy) ** 2) / (outerRy ** 2);
      const inner = ((x - cx) ** 2) / (innerRx ** 2) + ((y - cy) ** 2) / (innerRy ** 2);
      if (outer <= 1 && inner >= 1) blendPixel(canvas, x, y, color);
    }
  }
}

function fillRoundedRect(canvas, x, y, width, height, radius, color) {
  for (let py = y; py < y + height; py += 1) {
    for (let px = x; px < x + width; px += 1) {
      const left = px >= x + radius || py >= y + radius || (px - (x + radius)) ** 2 + (py - (y + radius)) ** 2 <= radius ** 2;
      const right = px < x + width - radius || py >= y + radius || (px - (x + width - radius - 1)) ** 2 + (py - (y + radius)) ** 2 <= radius ** 2;
      const bottomLeft = px >= x + radius || py < y + height - radius || (px - (x + radius)) ** 2 + (py - (y + height - radius - 1)) ** 2 <= radius ** 2;
      const bottomRight = px < x + width - radius || py < y + height - radius || (px - (x + width - radius - 1)) ** 2 + (py - (y + height - radius - 1)) ** 2 <= radius ** 2;
      if (left && right && bottomLeft && bottomRight) blendPixel(canvas, px, py, color);
    }
  }
}

function drawForeground(canvas) {
  const s = canvas.size;
  fillCircle(canvas, s / 2, s / 2, s * 0.24, [255, 255, 255, 235]);
  strokeEllipse(canvas, s / 2, s / 2, s * 0.38, s * 0.11, Math.max(10, s * 0.035), [255, 255, 255, 245]);
  fillCircle(canvas, s / 2, s / 2, s * 0.115, [124, 92, 255, 255]);

  const barColor = [9, 18, 36, 255];
  fillRoundedRect(canvas, Math.round(s * 0.30), Math.round(s * 0.37), Math.round(s * 0.045), Math.round(s * 0.22), Math.round(s * 0.02), barColor);
  fillRoundedRect(canvas, Math.round(s * 0.40), Math.round(s * 0.33), Math.round(s * 0.045), Math.round(s * 0.30), Math.round(s * 0.02), barColor);
  fillRoundedRect(canvas, Math.round(s * 0.50), Math.round(s * 0.40), Math.round(s * 0.045), Math.round(s * 0.18), Math.round(s * 0.02), barColor);

  fillCircle(canvas, s * 0.70, s * 0.41, s * 0.06, [255, 255, 255, 255]);
  fillCircle(canvas, s * 0.70, s * 0.41, s * 0.033, [46, 229, 157, 255]);
}

function createIcon(size) {
  const canvas = createCanvas(size);
  fillRoundedGradient(canvas, Math.round(size * 0.22), [124, 92, 255], [46, 229, 157]);
  drawForeground(canvas);
  return canvas;
}

function createAdaptiveForeground(size) {
  const canvas = createCanvas(size);
  drawForeground(canvas);
  return canvas;
}

function createSplash(size) {
  const canvas = createCanvas(size);
  fillRoundedGradient(canvas, Math.round(size * 0.25), [124, 92, 255], [46, 229, 157]);
  drawForeground(canvas);
  return canvas;
}

function writeCanvas(filename, canvas) {
  fs.writeFileSync(path.join(root, filename), encodePng(canvas.size, canvas.size, canvas.data));
}

writeCanvas("icon.png", createIcon(1024));
writeCanvas("adaptive-icon.png", createAdaptiveForeground(1024));
writeCanvas("splash-icon.png", createSplash(1024));

console.log("Mobile assets generated in", root);
