/** Avatar colour classes, cycled by list position. */
export const AVATAR = ['bg-primary text-primary-content', 'bg-secondary text-secondary-content', 'bg-accent text-accent-content', 'bg-base-300 text-base-content'];

/** @param {string | null} name */
export const initial = (name) => [...(name ?? '?')][0]?.toUpperCase() ?? '?';
