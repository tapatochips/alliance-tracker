// Cleans up a screenshot before OCR: grayscale, enlarge small images, flip light-on-dark text to
// dark-on-light (Tesseract reads that best), and stretch contrast.
import { OCR } from '../config.js';

const MAX_PIXELS = 7e6; // keeps phones from running out of memory on huge images

function loadImgElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve(img); setTimeout(() => URL.revokeObjectURL(url), 0); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That image couldn’t be opened.')); };
    img.src = url;
  });
}

async function decode(file) {
  if (window.createImageBitmap) {
    try { return await createImageBitmap(file); } catch (e) { /* fall back below */ }
  }
  return loadImgElement(file);
}

/** Returns a canvas ready for OCR. */
export async function prepareForOcr(file) {
  const src = await decode(file);
  const w = src.naturalWidth || src.width;
  const h = src.naturalHeight || src.height;
  if (!w || !h) throw new Error('That image is empty.');

  let scale = w < OCR.minWidth ? OCR.minWidth / w : 1;
  if (w * h * scale * scale > MAX_PIXELS) scale = Math.sqrt(MAX_PIXELS / (w * h));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, cw, ch);
  if (src.close) try { src.close(); } catch (e) { /* ignore */ }

  const img = ctx.getImageData(0, 0, cw, ch);
  const px = img.data;
  const n = cw * ch;
  const lum = new Uint8ClampedArray(n);
  const hist = new Uint32Array(256);
  let sum = 0;
  for (let i = 0, j = 0; j < n; i += 4, j++) {
    const y = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) | 0;
    lum[j] = y;
    hist[y]++;
    sum += y;
  }

  // Game screens are mostly dark with light text: invert so text ends up dark on a light background.
  const invert = sum / n < 118;

  // Contrast stretch between the 2nd and 98th percentile.
  let lo = 0, hi = 255, acc = 0;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= n * 0.02) { lo = v; break; } }
  acc = 0;
  for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc >= n * 0.02) { hi = v; break; } }
  const range = Math.max(1, hi - lo);

  for (let i = 0, j = 0; j < n; i += 4, j++) {
    let y = ((lum[j] - lo) * 255) / range;
    y = y < 0 ? 0 : y > 255 ? 255 : y;
    if (invert) y = 255 - y;
    px[i] = px[i + 1] = px[i + 2] = y;
    px[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}
