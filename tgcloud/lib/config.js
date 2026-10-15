import { api } from 'sdk';

// Per-instance values, read from the bot itself so a self-hosted copy needs no config.
// The Mini App is hosted at app<bot id>.tgcloud.ai. Cached for the life of a warm instance; a failed lookup is retried next time.
/** @type {Promise<{ appUrl: string, botUsername: string }> | null} */
let cached = null;

/** @returns {Promise<{ appUrl: string, botUsername: string }>} */
export function instance() {
  return (cached ??= api.getMe().then(
    (/** @type {{ id: number, username: string }} */ me) => ({ appUrl: `https://app${me.id}.tgcloud.ai`, botUsername: me.username }),
    (/** @type {unknown} */ e) => { cached = null; throw e; },
  ));
}

/** Tests: forget the cached lookup. */
export const forgetInstance = () => { cached = null; };
