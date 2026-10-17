// =====================================================================
//  GUNSHOT — entry point
// =====================================================================
import { S } from './config.js';
import { isTouch } from './util.js';
import { buildWorld } from './render/world.js';
import { initMenu } from './ui/menu.js';
import { initAds } from './ui/ads.js';
import { initInput } from './input.js';
import { startLoop } from './game/client.js';

window.__ok = true;
if (isTouch) document.body.classList.add('touch');
// wait briefly for web fonts (used inside canvas textures)
await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 2500))]).catch(() => { });
buildWorld(S.lastMap);
initMenu();
initInput();
initAds();
startLoop();
