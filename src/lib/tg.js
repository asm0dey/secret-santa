// Thin, null-safe wrappers over Telegram.WebApp: every call is a no-op or a harmless default in a plain browser.

// globalThis, not window: the pure modules also load under bun test. Absent in a plain browser if the script is blocked.
/** @returns {import('telegram-web-app').WebApp | undefined} */
export const wa = () => /** @type {Window} */ (/** @type {unknown} */ (globalThis)).Telegram?.WebApp;

export const inTelegram = () => !!wa()?.initData;

export function ready() {
  wa()?.ready();
  wa()?.expand();
}

/** @type {(() => void) | null} */
let backHandler = null;
/** @param {(() => void) | null} onClick null hides the button */
export function backButton(onClick) {
  const b = wa()?.BackButton;
  if (!b) return;
  if (backHandler) b.offClick(backHandler);
  backHandler = onClick;
  if (onClick) {
    b.onClick(onClick);
    b.show();
  } else b.hide();
}

/** @param {string} url @param {string} text */
export function share(url, text) {
  const link = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  const w = wa();
  if (w?.openTelegramLink) w.openTelegramLink(link);
  else open(link, '_blank', 'noopener');
}

/** @param {string} url */
export function openLink(url) {
  const w = wa();
  if (w?.openLink) w.openLink(url);
  else open(url, '_blank', 'noopener');
}

/** @returns {string | null} */
export function startParam() {
  const sp = wa()?.initDataUnsafe?.start_param;
  if (sp) return sp;
  // Dev only: `?startapp=K7Q4MX` in a plain browser.
  return inTelegram() ? null : new URLSearchParams(location.search).get('startapp');
}

/** @returns {Promise<boolean>} */
export function requestWriteAccess() {
  return new Promise((resolve) => {
    const w = wa();
    if (!w?.requestWriteAccess) return resolve(false);
    try {
      w.requestWriteAccess((allowed) => resolve(!!allowed));
    } catch {
      resolve(false);
    }
  });
}

// Plain-browser dev has no CloudStorage: fall back to localStorage so the theme still sticks.
/** @param {string} key @returns {Promise<string | null>} */
export function cloudGet(key) {
  return new Promise((resolve) => {
    const cs = wa()?.CloudStorage;
    try {
      if (!inTelegram() || !cs) return resolve(localStorage.getItem(key));
      cs.getItem(key, (err, v) => resolve(err || !v ? null : v));
    } catch {
      resolve(null);
    }
  });
}

/** @param {string} key @param {string} value @returns {Promise<true | null>} */
export function cloudSet(key, value) {
  return new Promise((resolve) => {
    const cs = wa()?.CloudStorage;
    try {
      if (!inTelegram() || !cs) {
        localStorage.setItem(key, value);
        return resolve(true);
      }
      cs.setItem(key, value, (err, ok) => resolve(err || !ok ? null : true));
    } catch {
      resolve(null);
    }
  });
}

/** @param {'light' | 'medium' | 'heavy' | 'rigid' | 'soft' | 'success' | 'warning' | 'error' | 'select'} type */
export function haptic(type) {
  const h = wa()?.HapticFeedback;
  if (!h) return;
  if (type === 'select') h.selectionChanged();
  else if (type === 'success' || type === 'warning' || type === 'error') h.notificationOccurred(type);
  else h.impactOccurred(type);
}
