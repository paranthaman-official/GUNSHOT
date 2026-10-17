// =====================================================================
//  GUNSHOT — central configuration.
//  Most tuning (guns, maps, modes, ads, keys) lives in this one file.
// =====================================================================
import { isTouch } from './util.js';

export const GAME = { name: 'GUNSHOT', version: '1.1.0' };

// ---------- Google AdSense ----------
// 1) Get approved for AdSense, 2) set enabled:true, put your publisher id and ad-unit slot ids.
// Ads only appear on menu / lobby / death screens — never during live gameplay.
// h5games:true enables AdSense "H5 Games Ads" interstitials between matches (needs separate approval).
export const ADS = {
  enabled: false,
  client: 'ca-pub-XXXXXXXXXXXXXXXX',
  slots: { home: '0000000000', lobby: '0000000000', death: '0000000000' },
  h5games: false,
  showPlaceholders: false // true = show dashed boxes where ads will go (for layout testing)
};

// ---------- Networking (PeerJS, free public broker) ----------
export const NETCFG = { prefix: 'gunshot-gg-v2-', maxConn: 12 };

// ---------- Physics ----------
export const PR = .42, EYE = 1.62, CEYE = 1.12, SEYE = .95, STEP = .42, SPEED = 6.6, GRAV = 24, JUMP = 8.2, HEAD = 1.78, LEAN = .48;
// hit spheres: [height, radius, isHead, leanFactor]
export const HB = [[1.66, .27, 1, 1], [1.15, .42, 0, .5], [.55, .36, 0, 0]];
export const HBC = [[1.16, .27, 1, 1], [.78, .42, 0, .5], [.35, .32, 0, 0]];

// ---------- Classes / guns ----------
// pw = gun power (ability). dur / cd in seconds.
export const CLS = {
  smg: { n: 'SMG', full: 'VX-9 VIPER', range: 'Close', dmg: 15, rate: 72, mag: 40, rl: 1500, spr: .032, adsSpr: .016, pel: 1, maxR: 60, hs: 1.6, spd: 1.08, zoom: 1.25, col: '#ffd166', st: [.35, .35, .95, .95],
    pw: { n: 'ADRENALINE', ic: '⚡', d: '5s · +35% move speed and 30% faster fire', dur: 5, cd: 18 } },
  ar: { n: 'Assault Rifle', full: 'AR-7 PHANTOM', range: 'Medium', dmg: 22, rate: 105, mag: 30, rl: 1700, spr: .024, adsSpr: .005, pel: 1, maxR: 130, hs: 1.8, spd: 1, zoom: 1.5, col: '#4cc9f0', st: [.5, .65, .75, .8],
    pw: { n: 'OVERCLOCK', ic: '∞', d: '6s · no ammo used and half the spread', dur: 6, cd: 22 } },
  sniper: { n: 'Sniper Rifle', full: 'HX-50 REAPER', range: 'Long', dmg: 100, rate: 1300, mag: 3, rl: 2030, spr: .09, adsSpr: 0, pel: 1, maxR: 260, hs: 2, spd: .92, zoom: 4.2, zooms: [4.2, 8], col: '#ff5a7e', scope: 1, st: [1, 1, .12, .6],
    pw: { n: 'DEADEYE', ic: '◉', d: '6s · zero scope sway and +25% damage', dur: 6, cd: 22 } },
  shotgun: { n: 'Shotgun', full: 'BRK-12 BRUTE', range: 'Close', dmg: 15, rate: 780, mag: 2, rl: 1600, spr: .085, adsSpr: .065, pel: 9, maxR: 34, hs: 1.4, spd: 1.03, zoom: 1.2, col: '#ff9f5a', fall: 1, st: [.95, .18, .3, .9],
    pw: { n: "DRAGON'S BREATH", ic: '🔥', d: '5s · +50% damage, tighter spread, burning rounds', dur: 5, cd: 18 } },
  dmr: { n: 'Semi-Auto Sniper', full: 'MK-14 HALO', range: 'Long', dmg: 45, rate: 280, mag: 7, rl: 1830, spr: .06, adsSpr: .002, pel: 1, maxR: 220, hs: 2, spd: .96, zoom: 3, zooms: [3, 6], col: '#b39dff', scope: 1, st: [.7, .9, .45, .7],
    pw: { n: 'PIERCE', ic: '➶', d: '6s · bullets go through walls and cover', dur: 6, cd: 24 } }
};
export const CK = ['smg', 'ar', 'sniper', 'shotgun', 'dmr'];
export const GG = ['smg', 'ar', 'shotgun', 'dmr', 'sniper']; // gun-game order

// ---------- Modes ----------
export const MODES = {
  ffa: { n: 'Free For All', teams: false, goal: 25, max: 12, desc: 'Everyone for themselves. First to 25 kills.' },
  tdm: { n: 'Team Deathmatch', teams: true, goal: 50, max: 12, desc: 'Alpha vs Bravo. First team to 50 kills.' },
  duel: { n: '1v1 Duel', teams: true, goal: 10, max: 2, desc: 'One on one. First to 10 kills wins.' },
  gun: { n: 'Gun Game', teams: false, goal: 10, max: 12, desc: 'Every 2 kills upgrades your gun. Finish the sniper to win.' },
  snipe: { n: 'Snipers Only', teams: false, goal: 20, max: 12, desc: 'Sniper rifles only. Pure aim. First to 20.' }
};
export const MK2 = Object.keys(MODES);

// ---------- Maps ----------
// Layout generators live in js/world/layout.js, visuals in js/render/world.js
export const MAPS = {
  base: { name: 'MILITARY BASE', tag: 'CLOSED · DAY', em: '🪖', desc: 'Fortified base: hangar, barracks and climbable watchtowers.', size: 40, seed: 71,
    sky: ['#5a88bd', '#a3c2df', '#d9e2e6'], fog: ['#c4ccd0', .013], hemi: ['#dde8f3', '#5b5646', 1.05], sun: ['#fff1dc', 2.2, [35, 45, -28]], ground: 'dirt', wall: 'base', fx: 'dust', expo: .92, bush: '#4e5f34', card: 'linear-gradient(160deg,#6c8a5a,#a8a27e 55%,#4a4a3a)' },
  house: { name: 'SUBURB HOUSE', tag: 'INDOOR · DAY', em: '🏠', desc: 'Fight room-to-room through a family house and its backyard.', size: 30, seed: 81,
    sky: ['#5a8cc6', '#a9c8e6', '#e3e8ea'], fog: ['#cdd5da', .012], hemi: ['#e4edf6', '#5c6a40', 1.1], sun: ['#fff3e2', 2.2, [30, 50, 25]], ground: 'grass', wall: 'house', fx: 'leaves', expo: .92, bush: '#46632e', card: 'linear-gradient(160deg,#87a8c8,#d8cbb0 55%,#5e7a46)' },
  office: { name: 'OFFICE TOWER', tag: 'INDOOR · DAY', em: '🏢', desc: 'Open-plan office floor: cubicles, glass meeting rooms and a server room.', bx: 26, bz: 20, seed: 121, indoor: 1, camH: 2.2,
    sky: ['#9ab4cc', '#c4d4e0', '#dfe6ec'], fog: ['#c9cfd4', .018], hemi: ['#f2f4f8', '#6a665e', 1.55], sun: ['#ffffff', .05, [10, 40, 10]], ground: 'carpet', wall: 'office', fx: 'none', expo: 1, card: 'linear-gradient(160deg,#9fb4c8,#e0e4e8 55%,#5a6470)' },
  warehouse: { name: 'WAREHOUSE', tag: 'INDOOR · INDUSTRIAL', em: '🏭', desc: 'Tall pallet racks, forklifts and a mezzanine with a view.', bx: 34, bz: 26, seed: 131, indoor: 1, camH: 3.2,
    sky: ['#222', '#2a2a2a', '#333'], fog: ['#2a2b2e', .018], hemi: ['#e8e6e0', '#4a4640', 1.45], sun: ['#ffffff', .05, [10, 40, 10]], ground: 'epoxy', wall: 'metal', fx: 'none', expo: 1.05, card: 'linear-gradient(160deg,#7a6a4a,#4a4a4e 60%,#1e2024)' },
  bunker: { name: 'BUNKER', tag: 'INDOOR · UNDERGROUND', em: '🛡️', desc: 'Concrete bunker grid: barracks, armory, generator rooms.', size: 24, seed: 141, indoor: 1, camH: 2,
    sky: ['#111', '#151515', '#1a1a1a'], fog: ['#1c1d1f', .028], hemi: ['#d8dce4', '#3a3630', 1.4], sun: ['#ffffff', .05, [10, 40, 10]], ground: 'tfloor', wall: 'conc', fx: 'none', expo: 1.05, card: 'linear-gradient(160deg,#5a5e54,#34362f 60%,#141512)' },
  tunnel: { name: 'METRO TUNNELS', tag: 'INDOOR · UNDERGROUND', em: '🚇', desc: 'Abandoned subway: tile corridors around a central train hall.', size: 30, seed: 91, indoor: 1, camH: 2.6,
    sky: ['#111', '#151515', '#1a1a1a'], fog: ['#16171a', .03], hemi: ['#c9d2e0', '#3a3630', 1.25], sun: ['#ffffff', .05, [10, 40, 10]], ground: 'tfloor', wall: 'tunnel', fx: 'none', expo: 1.05, card: 'linear-gradient(160deg,#4a4f58,#2a2c30 60%,#121316)' },
  bridge: { name: 'THE BRIDGE', tag: 'CLOSED · OVERCAST', em: '🌉', desc: 'A jammed suspension bridge. Buses, trucks and wrecks as cover.', bx: 10, bz: 52, seed: 101,
    sky: ['#7189a3', '#aebccb', '#cfd6dd'], fog: ['#b9c2cb', .012], hemi: ['#dfe6ee', '#4c5560', 1.1], sun: ['#f4f2ec', 1.7, [-30, 45, 15]], ground: 'asphalt', wall: 'harbor', fx: 'none', expo: .9, water: 1, bush: '#4a6036', card: 'linear-gradient(160deg,#7f95ab,#b5c0ca 55%,#3a4a5a)' },
  harbor: { name: 'HARBOR YARD', tag: 'CLOSED · DAY', em: '🚢', desc: 'Shipping-container maze. Climb the stairs onto the stacks.', size: 40, seed: 44,
    sky: ['#5d8fc8', '#a9c8e6', '#dfe8ee'], fog: ['#c9d3da', .014], hemi: ['#dfe9f5', '#5a5850', 1.1], sun: ['#fff3e0', 2.2, [45, 40, -25]], ground: 'concrete', wall: 'harbor', fx: 'none', expo: .95, bush: '#4f6436', card: 'linear-gradient(160deg,#7aa6d6,#c9d3da 55%,#6a6e74)' },
  neon: { name: 'TOKYO ALLEY', tag: 'CLOSED · NIGHT', em: '🏮', desc: 'Tight Tokyo streets at night. Close-quarters fights.', size: 34, seed: 11,
    sky: ['#0c0f1c', '#1c2236', '#2c2a3a'], fog: ['#20222e', .022], hemi: ['#9aa4c8', '#2a2a33', 1.35], sun: ['#b8c4ff', .9, [-20, 40, -15]], ground: 'asphalt', wall: 'neon', fx: 'rain', expo: 1, bush: '#35603a', card: 'linear-gradient(160deg,#3a3f6a,#2a2236 60%,#14161e)' },
  frost: { name: 'FROSTBITE', tag: 'SEMI-OPEN · SNOW', em: '❄️', desc: 'Snowy base with pine forest cover, cabins and lookouts.', size: 48, seed: 33,
    sky: ['#7d93ad', '#b9c6d4', '#d6dde5'], fog: ['#c3ccd6', .02], hemi: ['#dfe7f2', '#7e8a99', 1], sun: ['#ffffff', 1.4, [-30, 40, 20]], ground: 'snow', wall: 'frost', fx: 'snow', expo: .82, bush: '#5a6e62', card: 'linear-gradient(160deg,#9db3cc,#dfe6ee 55%,#6a7c90)' },
  dune: { name: 'DUNE OUTPOST', tag: 'OPEN · DAY', em: '🏜️', desc: 'Wide desert compound. Long sightlines and lookout towers.', size: 58, seed: 22,
    sky: ['#4a86c4', '#9cc4e4', '#e9dcc3'], fog: ['#ddd0b4', .0095], hemi: ['#d8e6f5', '#9c8058', 1.05], sun: ['#fff2dc', 2.4, [40, 55, 25]], ground: 'sand', wall: 'dune', fx: 'dust', expo: .88, bush: '#7a7444', card: 'linear-gradient(160deg,#6fa3d6,#e3c99a 55%,#a87e4a)' },
  ruins: { name: 'VERDANT RUINS', tag: 'OPEN · FOREST', em: '🌿', desc: 'Ancient stone ruins in a forest clearing.', size: 54, seed: 55,
    sky: ['#4f7eb2', '#aac6de', '#e3dcc4'], fog: ['#c3c4a8', .012], hemi: ['#dcebf8', '#4a5e30', 1.05], sun: ['#fff0d0', 2.3, [-45, 40, 30]], ground: 'grass', wall: 'ruins', fx: 'leaves', expo: .92, bush: '#45612c', card: 'linear-gradient(160deg,#6f9a5e,#d6c58e 55%,#3c5a2a)' }
};
export const MK = Object.keys(MAPS);

export const PALETTE = ['#ffb23f', '#c4f25a', '#4cc9f0', '#ff5a7e', '#ffd166', '#b39dff', '#5ce1a6', '#ffffff'];
export const TEAMC = ['#4ca8f0', '#f0505a'], TEAMN = ['ALPHA', 'BRAVO'];
export const BOT_NAMES = ['xKai', 'Nova', 'zyn', 'Lumi', 'Rizzler', 'ghxst', 'Vex', 'Mochi', 'Yuki', 'Blitz', 'Echo', 'Jinx'];
export const DIFF = { easy: { err: .09, react: .9, acc: .035, move: .8 }, normal: { err: .05, react: .5, acc: .016, move: 1 }, hard: { err: .022, react: .25, acc: .006, move: 1.1 } };

// ---------- Controls (rebindable) ----------
export const ACTIONS = [
  ['fwd', 'Move forward'], ['back', 'Move back'], ['left', 'Strafe left'], ['right', 'Strafe right'],
  ['fire', 'Shoot'], ['aim', 'Aim / scope'], ['jump', 'Jump · respawn'], ['sprint', 'Sprint · steady breath'], ['crouch', 'Crouch · slide (while sprinting)'],
  ['leanL', 'Peek left'], ['leanR', 'Peek right'], ['reload', 'Reload'], ['power', 'Gun power'], ['zoom', 'Scope zoom level'],
  ['pov', 'Switch 1st / 3rd person'], ['chat', 'Chat'], ['scores', 'Scoreboard']
];
export const DEFAULT_KEYS = { fwd: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', fire: 'Mouse0', aim: 'Mouse2', jump: 'Space', sprint: 'ShiftLeft', crouch: 'KeyC',
  leanL: 'KeyQ', leanR: 'KeyE', reload: 'KeyR', power: 'KeyF', zoom: 'KeyZ', pov: 'KeyV', chat: 'Enter', scores: 'Tab' };

// ---------- Player settings (saved in localStorage) ----------
const SKEY = 'gs2_settings';
const DEF = { name: '', col: '#ffb23f', cls: 'ar', keys: {}, adsToggle: false, sprintToggle: false, autoRl: true, sens: 1, adsSens: .8, invY: false,
  pov: 'fp', q: isTouch ? 'low' : 'med', fov: 85, bright: 1, shake: true, bob: true, fps: false, xh: 'cross', xhc: '#c4f25a', dmgn: true, vol: .6,
  touchScale: 1, leftFire: true, leftHanded: false,
  lastMap: 'base', lastMode: 'ffa', lastDiff: 'normal', lastAim: 'manual', lastFire: 'manual', lastTime: 5 };
let saved = {}; try { saved = JSON.parse(localStorage.getItem(SKEY) || '{}') } catch (e) { }
export const S = Object.assign({}, DEF, saved);
S.keys = Object.assign({}, DEFAULT_KEYS, S.keys || {});
if (!MAPS[S.lastMap]) S.lastMap = 'base';
export const saveS = () => localStorage.setItem(SKEY, JSON.stringify(S));

const STKEY = 'gs2_stats';
let st = {}; try { st = JSON.parse(localStorage.getItem(STKEY) || '{}') } catch (e) { }
export const ST = Object.assign({ k: 0, d: 0, w: 0, m: 0, hs: 0, best: 0 }, st);
export const saveST = () => localStorage.setItem(STKEY, JSON.stringify(ST));
