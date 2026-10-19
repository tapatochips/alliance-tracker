// Saving files from the page (CSV export, backups) and reading files people pick.

/** Start a download of `text` as `filename`. */
export function downloadText(filename, text, mime = 'text/plain') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** True if this device can hand a file to the share sheet (phones). */
export function canShareFiles() {
  try {
    const f = new File(['{}'], 'test.json', { type: 'application/json' });
    return !!(navigator.canShare && navigator.canShare({ files: [f] }));
  } catch (e) {
    return false;
  }
}

/** Open the phone's share sheet with a text file attached. Resolves false if the person cancels. */
export async function shareText(filename, text, mime = 'application/json') {
  const file = new File([text], filename, { type: mime });
  try {
    await navigator.share({ files: [file], title: filename });
    return true;
  } catch (e) {
    return false;
  }
}

export const readFileText = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result || ''));
  r.onerror = () => reject(r.error);
  r.readAsText(file);
});

/** One CSV cell. Guards against spreadsheet formulas sneaking in through player names. */
export function csvCell(v) {
  let s = String(v == null ? '' : v);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export const toCsv = (rows) => rows.map((r) => r.map(csvCell).join(',')).join('\n');
