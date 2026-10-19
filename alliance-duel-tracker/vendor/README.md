# Bundled libraries

These files are hosted with the app, so screenshot reading works without depending on another website.

| Folder | Package | Version | License |
|---|---|---|---|
| `tesseract/` | [tesseract.js](https://github.com/naptha/tesseract.js) (`dist/tesseract.min.js`, `dist/worker.min.js`) | 6.0.1 | Apache-2.0 (`tesseract/LICENSE.md`) |
| `tesseract-core/` | [tesseract.js-core](https://github.com/naptha/tesseract.js-core) (LSTM builds, with and without SIMD) | 6.0.0 | Apache-2.0 (`tesseract-core/LICENSE`) |
| `tessdata/` | [@tesseract.js-data/eng](https://www.npmjs.com/package/@tesseract.js-data/eng), `4.0.0_best_int/eng.traineddata.gz` | 1.0.0 | Apache-2.0 (Tesseract tessdata) |

The reader picks the SIMD build automatically on devices that support it. Both builds are needed.
