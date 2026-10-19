// Loads Tesseract (the open-source OCR engine) from vendor/ and runs it in a background worker.
// Everything happens on the device: the screenshots never leave the phone or computer.
import { OCR } from '../config.js';

let workerPromise = null;
let progressHandler = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (window.Tesseract) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('The screenshot reader couldn’t load. Check your connection and reload the page.'));
    document.head.append(s);
  });
}

/** Called with Tesseract progress messages: {status, progress 0..1}. */
export function setProgressHandler(fn) { progressHandler = fn; }

/** Start (once) and return the OCR worker. The first call downloads about 7 MB, then the browser caches it. */
export function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      await loadScript(OCR.scriptPath);
      const T = window.Tesseract;
      if (!T || !T.createWorker) throw new Error('The screenshot reader couldn’t start in this browser.');
      const worker = await T.createWorker(OCR.languages, T.OEM.LSTM_ONLY, {
        workerPath: OCR.workerPath,
        corePath: OCR.corePath,
        langPath: OCR.langPath,
        workerBlobURL: false,
        logger: (m) => { if (progressHandler) progressHandler(m); },
        errorHandler: (e) => console.warn('OCR worker error:', e),
      });
      await worker.setParameters({
        // Ranking screenshots have repeated, aligned rows; block segmentation keeps related words together.
        tessedit_pageseg_mode: T.PSM.SINGLE_BLOCK,
        preserve_interword_spaces: '1',
        user_defined_dpi: '300',
      });
      return worker;
    })().catch((e) => { workerPromise = null; throw e; });
  }
  return workerPromise;
}

/** Recognise one prepared image (a canvas). Returns every word with its position and confidence. */
export async function recognizeWords(canvas) {
  const worker = await getWorker();
  const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true });
  const words = [];
  for (const b of data.blocks || []) {
    for (const p of b.paragraphs || []) {
      for (const l of p.lines || []) {
        for (const w of l.words || []) {
          const text = (w.text || '').trim();
          if (!text || !w.bbox) continue;
          words.push({ text, conf: w.confidence, x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 });
        }
      }
    }
  }
  return { words, text: data.text || '' };
}

/** Recognize a tightly cropped, single-line field with an optional character whitelist. */
export async function recognizeLine(canvas, whitelist = '') {
  const worker = await getWorker();
  const T = window.Tesseract;
  await worker.setParameters({
    tessedit_pageseg_mode: T.PSM.SINGLE_LINE,
    tessedit_char_whitelist: whitelist,
  });
  try {
    const { data } = await worker.recognize(canvas, {}, { text: true });
    return { text: data.text || '', conf: data.confidence || 0 };
  } finally {
    await worker.setParameters({
      tessedit_pageseg_mode: T.PSM.SINGLE_BLOCK,
      preserve_interword_spaces: '1',
      user_defined_dpi: '300',
      tessedit_char_whitelist: '',
    });
  }
}

/** Stop the reader immediately (used by the Stop button). The next read starts a fresh one. */
export async function stopReader() {
  const p = workerPromise;
  workerPromise = null;
  if (!p) return;
  try { (await p).terminate(); } catch (e) { /* already gone */ }
}
