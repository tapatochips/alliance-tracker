// App-wide constants. Change the Duel day names here if your server's rotation differs.

/** The six Alliance Duel days, Monday (Day 1) to Saturday (Day 6). `key` is how scores are stored. */
export const DAYS = [
  { n: 1, key: 'd1', name: 'Modded Vehicle Boost', short: 'Vehicles' },
  { n: 2, key: 'd2', name: 'Shelter Upgrade', short: 'Shelter' },
  { n: 3, key: 'd3', name: 'Age of Science', short: 'Science' },
  { n: 4, key: 'd4', name: 'Hero Initiative', short: 'Heroes' },
  { n: 5, key: 'd5', name: 'Holistic Growth', short: 'Growth' },
  { n: 6, key: 'd6', name: 'Enemy Buster', short: 'Enemy Buster' },
];

/** Sort order for alliance ranks (R5 = leader). */
export const RANK_ORDER = { R5: 0, R4: 1, R3: 2, R2: 3, R1: 4, '': 5 };
export const RANKS = ['R5', 'R4', 'R3', 'R2', 'R1'];

/** Where the tracker keeps its data in the browser. Changing this starts a fresh, empty tracker. */
export const STORAGE_KEY = 'alliance-duel-tracker:v1';

/** Name written into backup files so the importer can recognise them. */
export const BACKUP_APP_ID = 'alliance-duel-tracker';

/** On-device screenshot reading (Tesseract OCR). Paths are relative to index.html. */
export const OCR = {
  scriptPath: 'vendor/tesseract/tesseract.min.js',
  workerPath: 'vendor/tesseract/worker.min.js',
  corePath: 'vendor/tesseract-core/',
  langPath: 'vendor/tessdata/',
  // Add more languages with '+', e.g. 'eng+kor', after putting kor.traineddata.gz in vendor/tessdata/.
  languages: 'eng',
  // Screenshots narrower than this are enlarged before reading; small text reads better bigger.
  minWidth: 1100,
  // Words in a row whose text matches these are treated as screen labels, not player names.
  ignoreWords: ['rank', 'ranking', 'rankings', 'points', 'point', 'score', 'daily', 'weekly', 'total', 'reward', 'rewards',
    'alliance', 'duel', 'member', 'members', 'my', 'personal', 'contribution', 'lv', 'level', 'server'],
};
