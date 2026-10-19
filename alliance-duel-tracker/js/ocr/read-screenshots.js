// Reads a batch of ranking screenshots one after another and collects the rows.
import { getWorker, recognizeLine, recognizeWords, setProgressHandler, stopReader } from './engine.js';
import { prepareForOcr } from './preprocess.js';
import { wordsToRows } from './ranking-parser.js';
import { parsePoints } from '../lib/numbers.js';

const MIN_SCORE_CONFIDENCE = 60;
const MIN_NAME_CONFIDENCE = 70;

function rankingLayout(width, height) {
  if (width / height < 1) {
    return {
      rankRight: 0.17,
      nameLeft: 0.35,
      nameRight: 0.62,
      pointsLeft: 0.64,
      pointsRight: 0.96,
    };
  }
  return {
    rankRight: 0.12,
    nameLeft: 0.24,
    nameRight: 0.46,
    pointsLeft: 0.45,
    pointsRight: 0.67,
  };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
}

function rankedRowCenters(words, width, height, layout) {
  const anchors = words
    .filter((w) => w.x1 < width * layout.rankRight && w.y0 > height * 0.2 && (w.conf == null || w.conf >= 40))
    .map((w) => {
      const m = w.text.match(/^(?:#|no\.?)?(\d{1,2})[.)]?$/i);
      return m ? { rank: Number(m[1]), y: (w.y0 + w.y1) / 2 } : null;
    })
    .filter(Boolean);
  if (anchors.length < 2) return [];

  const slopes = [];
  for (let i = 0; i < anchors.length; i++) {
    for (let j = i + 1; j < anchors.length; j++) {
      const rankGap = Math.abs(anchors[i].rank - anchors[j].rank);
      if (rankGap && rankGap <= 10) slopes.push(Math.abs(anchors[i].y - anchors[j].y) / rankGap);
    }
  }
  const step = median(slopes);
  if (step < height * 0.05 || step > height * 0.35) return [];
  const base = median(anchors.map((a) => a.y - a.rank * step));
  const first = Math.min(...anchors.map((a) => a.rank));
  const last = Math.max(...anchors.map((a) => a.rank));
  if (last - first > 40) return [];

  return Array.from({ length: last - first + 1 }, (_, i) => {
    const rank = first + i;
    return { rank, y: base + rank * step, step };
  }).filter((row) => row.y > 0 && row.y < height);
}

function crop(canvas, x0, y0, x1, y1) {
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round((x1 - x0) * 2));
  out.height = Math.max(1, Math.round((y1 - y0) * 2));
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, x0, y0, x1 - x0, y1 - y0, 0, 0, out.width, out.height);
  return out;
}

function threshold(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < image.data.length; i += 4) {
    const luminance = image.data[i] * 0.299 + image.data[i + 1] * 0.587 + image.data[i + 2] * 0.114;
    const value = luminance < 210 ? 0 : 255;
    image.data[i] = image.data[i + 1] = image.data[i + 2] = value;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

async function readRankedRows(canvas, centers, layout) {
  const rows = [];
  for (const { y, step } of centers) {
    const nameImage = crop(
      canvas,
      canvas.width * layout.nameLeft,
      y - step * 0.28,
      canvas.width * layout.nameRight,
      y + step * 0.05,
    );
    const pointsImage = crop(
      canvas,
      canvas.width * layout.pointsLeft,
      y - step * 0.13,
      canvas.width * layout.pointsRight,
      y + step * 0.18,
    );
    let nameResult = await recognizeLine(nameImage, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789[]');
    if (nameResult.conf < MIN_NAME_CONFIDENCE) {
      const thresholdName = await recognizeLine(threshold(nameImage), 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789[]');
      if (thresholdName.conf > nameResult.conf) nameResult = thresholdName;
    }
    let pointsResult = await recognizeLine(pointsImage, '0123456789,.');
    if (pointsResult.conf < MIN_SCORE_CONFIDENCE) {
      const thresholdPoints = await recognizeLine(threshold(pointsImage), '0123456789,.');
      if (thresholdPoints.conf > pointsResult.conf) pointsResult = thresholdPoints;
    }
    const name = nameResult.text.replace(/[^\p{L}\p{N}\[\] _-]/gu, '').replace(/\s+/g, ' ').trim();
    const digits = pointsResult.text.replace(/\D/g, '');
    const parsed = digits.length >= 5 ? parsePoints(digits) : null;
    const points = parsed && parsed.ok && typeof parsed.value === 'number' &&
      pointsResult.conf >= MIN_SCORE_CONFIDENCE ? parsed.value : null;
    if (name.length >= 2) {
      rows.push({ name, points, conf: nameResult.conf });
    }
  }
  return rows;
}

/**
 * @param {File[]} files
 * @param {{onStatus: (msg: string) => void, isStopped: () => boolean}} opts
 * @returns {Promise<{rows: {name, points, conf}[], failed: number[], stopped: boolean}>}
 */
export async function readScreenshots(files, { onStatus, isStopped }) {
  const n = files.length;
  let current = 0;
  setProgressHandler((m) => {
    if (m.status === 'recognizing text') {
      onStatus(`Reading screenshot ${current + 1} of ${n}… ${Math.round((m.progress || 0) * 100)}%`);
    } else if (/loading|initializ/i.test(m.status || '')) {
      onStatus('Starting the screenshot reader… the first time takes a few seconds.');
    }
  });

  onStatus('Starting the screenshot reader… the first time takes a few seconds.');
  await getWorker();

  const rows = [];
  const failed = [];
  for (current = 0; current < n; current++) {
    if (isStopped()) break;
    try {
      onStatus(`Reading screenshot ${current + 1} of ${n}…`);
      const canvas = await prepareForOcr(files[current]);
      const layout = rankingLayout(canvas.width, canvas.height);
      const { words } = await recognizeWords(canvas);
      let found = wordsToRows(words);
      const centers = rankedRowCenters(words, canvas.width, canvas.height, layout);
      if (centers.length) {
        onStatus(`Checking ${centers.length} visible ranking rows…`);
        const croppedRows = await readRankedRows(canvas, centers, layout);
        if (croppedRows.length) found = croppedRows;
      }
      if (!found.length) failed.push(current + 1);
      rows.push(...found);
    } catch (e) {
      if (isStopped()) break;
      failed.push(current + 1);
    }
  }
  setProgressHandler(null);
  return { rows, failed, stopped: isStopped() };
}

export { stopReader };
