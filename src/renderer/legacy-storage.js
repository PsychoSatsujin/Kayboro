// One-time copy of pre-rename UI settings: Shellcade kept them under 'shellcade.*' keys (the main process copies
// its Local Storage folder over, see src/main/migrate.js). Each one is copied to its 'kayboro.*' key unless that
// is already set; built-in wallpaper references in them ({"source":"shellcade"}) are renamed. Old keys are kept.
const OLD = 'shellcade.', NEW = 'kayboro.', DONE = 'kayboro.legacyKeys';

export function migrateLegacyKeys(store) {
  if (!store || store.getItem(DONE)) return 0;
  let n = 0;
  for (const k of Array.from({ length: store.length }, (_, i) => store.key(i))) {
    if (!k?.startsWith(OLD) || store.getItem(NEW + k.slice(OLD.length)) != null) continue;
    store.setItem(NEW + k.slice(OLD.length), String(store.getItem(k)).replaceAll('"source":"shellcade"', '"source":"kayboro"'));
    n++;
  }
  store.setItem(DONE, '1');
  return n;
}

try { migrateLegacyKeys(globalThis.localStorage); } catch {}
