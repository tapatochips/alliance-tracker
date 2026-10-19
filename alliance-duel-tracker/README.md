# Alliance Duel Tracker

A web app for Last Z: Survival Shooter alliance officers. It tracks each member's daily Alliance Duel points (Days 1–6), flags anyone under the daily minimum or with no score, and keeps weekly history.

Screenshots of the in-game ranking are read on your device with Tesseract OCR. Nothing is uploaded by the screenshot reader.

## What it does

- **Week grid:** members down the side, Duel Days 1–6 across, with week totals. Tap any score to edit it.
- **Minimums and flags:** set a minimum for each day and an optional minimum weekly total in **Minimums**. Scores under daily minimums turn red; weekly totals below the weekly minimum are also flagged once scores have been recorded for the week. A member with no score on an entered day shows **Missed**. Type `ex` in a cell to excuse someone.
- **Add scores:** pick, drop or paste ranking screenshots, or paste text (`Raven 3,240,000`, one per line). You review every name and score before saving. Close misreads like `lronside` are matched to `Ironside`, and the closest roster names are listed first.
- **History:** the last 8 recorded weeks per member, with flag counts and weekly average.
- **Roster:** edit names (old names still match), delete members and their saved scores, set ranks (R1–R5), mark members who left, and merge duplicates.
- **Follow-up list:** ready-to-paste text for alliance chat.
- **Export CSV** for spreadsheets, and **Backup** to save, share or restore everything.
- **Support this project:** make an optional one-time contribution through Stripe.

## Running it

The app has to be opened from a web address. Double-clicking `index.html` won't work, because browsers block the OCR reader and the code modules for files opened straight from disk.

### Free hosting (recommended, works on phones)

Any static host works. Two easy ones:

- **Netlify Drop:** go to <https://app.netlify.com/drop> on a computer and upload the site files (`index.html`, `css/`, `js/`, and `vendor/`). You get a link right away. Make a free account to keep it.
- **GitHub Pages:** create a repository, upload the site files (so `index.html` is at the top level), then go to **Settings → Pages**, set the source to the main branch, and save. The link appears after about a minute.

Open the link on your phone and use **Add to Home Screen** for quick access.

### On your own computer

From inside this folder, run either of these, then open <http://localhost:8000>:

```
python3 -m http.server 8000
npx serve -l 8000
```

## Where the data lives

Scores are saved in the browser on each device (localStorage). That means:

- Each phone or browser has its own copy. Clearing browser data or using private browsing erases it.
- **Backup → Download backup file** (or **Copy as text**) saves everything. Do this regularly.
- **Sharing between officers:** one person sends their backup, and the others use **Backup → Load backup → Combine with my data**. Members are matched by name, so separately built rosters line up. Their scores fill in empty days, and where you both have a score for the same day, yours is kept.

To have every officer edit one live tracker, the storage layer can be swapped for a hosted database such as Firebase or Supabase. All saving and loading goes through `js/data/store.js`, so that is the only file that would need to change.

## TODO

- Support multiple alliances with separate trackers, so each alliance has its own roster, settings, and score history.
- Add optional shared online storage and officer access, so invited officers can work on the same alliance tracker across devices without exposing one alliance's data to another.

## Tips for better screenshot reading

- Screenshot the **alliance member ranking for the day**, with the list filling most of the screen. Several scrolled screenshots are fine, because overlapping names are counted once.
- Use the original screenshot rather than a resized or compressed copy. The reader can enlarge small images, but enlarging cannot restore text detail that was lost when an image was reduced.
- Rows marked **check** or **not on roster** are guesses, so confirm them in the review list before saving.
- If a screenshot score is too uncertain to read, its field stays blank and saving is disabled until you enter the score or skip that row.
- The screenshot reader runs entirely on your device; review its names and scores before saving.
- Unusual names (symbols, emoji, non-English letters) are the hardest to read. Pick the right member from the list once; after that, renaming them in the roster to match what the reader sees makes later matches automatic.
- The first read on a device downloads about 7 MB for the reader. After that it is cached and each screenshot takes a few seconds.

## Customising

All settings are in `js/config.js`:

- `DAYS`: the Duel day names, if your server's rotation differs.
- `OCR.languages`: add languages for non-English player names, for example `'eng+kor'`. Download the matching `kor.traineddata.gz` from <https://cdn.jsdelivr.net/npm/@tesseract.js-data/kor/4.0.0_best_int/kor.traineddata.gz> and put it in `vendor/tessdata/`. Each language adds a few MB and slows reading a little.
- `OCR.ignoreWords`: screen labels that should never be read as a player name.

## Folder map

```
index.html                  page structure and dialogs
css/
  tokens.css                colours (light + dark), fonts
  layout.css                header, tabs, tiles, cards, buttons
  tables.css                week grid, history, roster tables
  dialogs.css               pop-up dialogs, screenshot picker, review table
js/
  main.js                   start-up: load data, connect buttons, first draw
  config.js                 Duel days, OCR settings, storage key
  state.js                  what's on screen (week, tab, sorting) + redraw scheduling
  data/
    store.js                saved data and every change to it (localStorage)
    backup.js               backup files: export, load, combine
    sample.js               "Preview with sample data"
  model/
    week.js                 weekly maths: totals, below-minimum, missed days, sorting
  lib/
    dom.js                  element builder, toast, clipboard
    dates.js                Duel week dates (Monday = Day 1)
    numbers.js              read/format points (2.4m, 850k, 2,400,000)
    names.js                name matching, including OCR look-alike letters
    text-import.js          "Paste text" parser
    files.js                downloads, share sheet, CSV
  ocr/
    engine.js               starts Tesseract in a background worker
    preprocess.js           screenshot clean-up before reading
    ranking-parser.js       OCR words → {name, points} rows
    read-screenshots.js     reads a batch of screenshots
  ui/
    render.js               draws the open tab
    header.js               title, week switcher, banner
    week-view.js            Week tab + inline score editing
    history-view.js         History tab
    roster-view.js          Roster tab
    scores-dialog.js        Add scores (screenshots / paste / review / save)
    settings-dialog.js      Minimums
    followup-dialog.js      Follow-up list
    backup-dialog.js        Backup & share
    export-csv.js           CSV export
    widgets.js              shared bits (stat tiles, sortable headers)
vendor/                     Tesseract OCR (see vendor/README.md)
```

There is no build step and no dependencies to install. Edit any file and reload the page.
