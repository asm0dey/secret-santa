import { defineConfig, loadEnv } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

// Per-instance values for the privacy policy. Set them in .env.local (git-ignored); a build without them fails.
const PRIVACY_ENV = ['VITE_PRIVACY_CONTROLLER', 'VITE_PRIVACY_CONTACT'];

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd());
  const missing = PRIVACY_ENV.filter((k) => !env[k]?.trim());
  if (command === 'build' && missing.length) throw new Error(`Set ${missing.join(', ')} in .env.local (see .env.example)`);
  return {
    plugins: [tailwindcss(), svelte()],
    build: { outDir: 'dist' },
  };
});
