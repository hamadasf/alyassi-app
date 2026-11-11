// Read before anything else of the app runs (it is main.js's first import): is this a fresh install — nothing of the
// app saved on this phone yet? Used to show the welcome screen to new users only.
export const NEW_USER = (() => { try { return !Object.keys(localStorage).some((k) => /^(oay|dnp)/i.test(k)); } catch { return false; } })();
