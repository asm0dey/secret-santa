import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import { ready } from './lib/tg.js';
import { applyTheme, mirroredPref } from './lib/theme.js';
import { initRouter } from './lib/router.js';

ready();
applyTheme(mirroredPref()); // right away, so there is no flash before the saved choice loads (App does that)
initRouter();

mount(App, { target: /** @type {HTMLElement} */ (document.getElementById('app')) });
