import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import { ready } from './lib/tg.js';
import { applyTheme } from './lib/theme.js';
import { initRouter } from './lib/router.js';

ready();
applyTheme('auto'); // right away, so there is no flash before the saved choice loads (App does that)
initRouter();

mount(App, { target: /** @type {HTMLElement} */ (document.getElementById('app')) });
