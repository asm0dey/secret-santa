import { cloudGet, cloudSet, wa } from './tg.js';

/** @typedef {'auto' | 'light' | 'dark' | 'christmas'} ThemePref */
/** @typedef {'tglight' | 'tgdark' | 'christmas'} ThemeName */

export const THEME_PREFS = /** @type {const} */ (['auto', 'light', 'dark', 'christmas']);

/** @param {ThemePref} pref @param {'light' | 'dark'} scheme @returns {ThemeName} */
export function resolveTheme(pref, scheme) {
  if (pref === 'christmas') return 'christmas';
  const s = pref === 'auto' ? scheme : pref;
  return s === 'dark' ? 'tgdark' : 'tglight';
}

// themeParams key -> daisyUI variable
const VARS = /** @type {const} */ ({
  bg_color: '--color-base-100',
  secondary_bg_color: '--color-base-200',
  text_color: '--color-base-content',
  button_color: '--color-primary',
  button_text_color: '--color-primary-content',
  link_color: '--color-accent',
});

/** @type {ThemePref} */
let current = 'auto';
let listening = false;

/** @returns {'light' | 'dark'} */
function schemeNow() {
  const tg = wa();
  if (tg?.colorScheme) return tg.colorScheme;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** @param {ThemePref} pref */
export function applyTheme(pref) {
  current = pref;
  const root = document.documentElement;
  const tg = wa();
  const name = resolveTheme(pref, schemeNow());
  root.dataset.theme = name;

  // Telegram's own colours only fit the scheme Telegram is in: "Light" while Telegram is dark keeps the built-in light palette.
  const useParams = name !== 'christmas' && tg?.themeParams && (name === 'tgdark') === (tg.colorScheme === 'dark');
  for (const [key, cssVar] of Object.entries(VARS)) {
    const v = useParams ? tg.themeParams[/** @type {keyof typeof VARS} */ (key)] : undefined;
    if (v) root.style.setProperty(cssVar, v);
    else root.style.removeProperty(cssVar);
  }

  const bg = getComputedStyle(root).getPropertyValue('--color-base-100').trim();
  if (tg && /^#[0-9a-f]{6}$/i.test(bg)) {
    tg.setHeaderColor?.(/** @type {`#${string}`} */ (bg));
    tg.setBackgroundColor?.(/** @type {`#${string}`} */ (bg));
  }

  if (!listening && tg?.onEvent) {
    listening = true;
    tg.onEvent('themeChanged', () => applyTheme(current));
  }
}

/** @param {unknown} v @returns {ThemePref} */
const asPref = (v) => THEME_PREFS.find((p) => p === v) ?? 'auto';

// localStorage mirror of the pref, read synchronously so the first paint is right (index.html does the same inline).
// CloudStorage stays the source of truth: loadThemePref overrides it after load.
/** @returns {ThemePref} */
export function mirroredPref() {
  try {
    return asPref(localStorage.getItem('theme'));
  } catch {
    return 'auto';
  }
}

/** @param {ThemePref} pref */
function mirror(pref) {
  try {
    localStorage.setItem('theme', pref);
  } catch {}
}

/** @type {ThemePref | null} */
let chosen = null;

/** The saved pref, unless the user picked one while it was loading (then theirs wins). @returns {Promise<ThemePref>} */
export async function loadThemePref() {
  const v = asPref(await cloudGet('theme'));
  if (chosen) return chosen;
  mirror(v);
  return v;
}

/** @param {ThemePref} pref */
export function saveThemePref(pref) {
  chosen = pref;
  mirror(pref);
  return cloudSet('theme', pref);
}
