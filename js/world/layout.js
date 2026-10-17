// =====================================================================
//  Map layouts (collision boxes, spawns, hiding spots, bot nav grid).
//  Deterministic: every player builds the same layout from MAPS[id].seed.
//  To add a map: add an entry in config.js MAPS + a generator branch below.
//  Object: {k:kind, x,z (centre), w,d (size x/z), h (top height), y0 (bottom height)}
// =====================================================================
import { MAPS, PR, STEP } from '../config.js';
import { clamp, mulberry } from '../util.js';

export const W = { BX: 34, BZ: 34, SZ: 34, GX: Infinity, GZ: Infinity, L: [], COL: [], HIDE: [], SP_FFA: [], SP_T: [[], []], NAV: null, MAPID: 'base' };
export const HIDE_KINDS = new Set(['bush', 'plant', 'strip']);   // walk-in concealment, bullets pass through
const SOFT_BULLET = new Set(['railp']);                           // blocks movement, not bullets

export function genLayout(id) {
  const m = MAPS[id], R = mulberry(m.seed);
  W.MAPID = id; W.BX = m.bx || m.size; W.BZ = m.bz || m.size; W.SZ = Math.max(W.BX, W.BZ);
  const BX = W.BX, BZ = W.BZ, L = []; W.L = L;
  W.GX = m.water ? BX + .5 : Infinity; W.GZ = m.water ? BZ + 12 : Infinity;
  const rr = (a, b) => a + R() * (b - a);
  const SP_T = [[], []], sw = Math.min(BX, 30) * .22;
  for (let i = 0; i < 6; i++) { const x = (i - 2.5) * sw; SP_T[0].push([x, -(BZ - 3)]); SP_T[1].push([-x, BZ - 3]) }
  let SP_FFA = []; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + .2; SP_FFA.push([clamp(Math.cos(a) * BX * 1.3, -(BX - 3.5), BX - 3.5), clamp(Math.sin(a) * BZ * 1.3, -(BZ - 3.5), BZ - 3.5)]) }
  const allSp = [...SP_FFA, ...SP_T[0], ...SP_T[1]];

  const P = (k, x, z, w, d, h, y0 = 0, ex) => { const o = Object.assign({ k, x, z, w, d, h, y0, v: Math.floor(R() * 1000) }, ex || {}); L.push(o); return o };
  const ok = (x, z, w, d, pad) => {
    if (Math.abs(x) + w / 2 > BX - 1 || Math.abs(z) + d / 2 > BZ - 1) return false;
    for (const s of allSp) if (Math.abs(s[0] - x) < w / 2 + 2.6 && Math.abs(s[1] - z) < d / 2 + 2.6) return false;
    for (const l of L) if (Math.abs(l.x - x) < (l.w + w) / 2 + pad && Math.abs(l.z - z) < (l.d + d) / 2 + pad) return false;
    return true
  };
  const add = (k, x, z, w, d, h, pad = 1.8, mir = true) => {
    const isC = Math.abs(x) < .5 && Math.abs(z) < .5; if (!ok(x, z, w, d, pad)) return false;
    if (mir && !isC) { if (!ok(-x, -z, w, d, pad) || (Math.abs(x) < (w + pad) && Math.abs(z) < (d + pad))) return false }
    const v = Math.floor(R() * 1000); L.push({ k, x, z, w, d, h, y0: 0, v }); if (mir && !isC) L.push({ k, x: -x, z: -z, w, d, h, y0: 0, v }); return true
  };
  const scatter = (k, n, fn, pad = 1.8, tries = 60) => { let c = 0; for (let t = 0; t < n * tries && c < n; t++) { const o = fn(); const rot = o.rot && R() < .5; if (add(k, rr(-BX + 2, BX - 2), rr(-BZ + 2, BZ - 2), rot ? o.d : o.w, rot ? o.w : o.d, o.h, pad)) c++ } };
  const hides = (k, n, w, d, h) => { let c = 0; for (let t = 0; t < n * 80 && c < n; t++) { const x = rr(-BX + 2, BX - 2), z = rr(-BZ + 2, BZ - 2); if (ok(x, z, w, d, 1.3)) { P(k, x, z, w, d, h); c++ } } };
  // straight wall with doors ('door') / windows ('win') / gaps ('gap'): ops=[[pos,width,type]]
  const wallLine = (x0, z0, x1, z1, h, ops = [], k = 'iw', t = .35) => {
    const hor = z0 === z1, a0 = hor ? Math.min(x0, x1) : Math.min(z0, z1), a1 = hor ? Math.max(x0, x1) : Math.max(z0, z1), c = hor ? z0 : x0;
    const seg = (s, e, y0, y1) => { if (e - s < .05) return; const mid = (s + e) / 2; if (hor) P(k, mid, c, e - s, t, y1, y0); else P(k, c, mid, t, e - s, y1, y0) };
    let cur = a0; for (const [pos, w, ty] of [...ops].sort((p, q) => p[0] - q[0])) { const s = pos - w / 2, e = pos + w / 2; seg(cur, s, 0, h); if (ty === 'door' && h > 2.4) seg(s, e, 2.3, h); if (ty === 'win') { seg(s, e, 0, 1); seg(s, e, 2.05, h) } cur = e } seg(cur, a1, 0, h)
  };
  const room = (x0, z0, x1, z1, h, sd, roofK, k = 'iw') => { wallLine(x0, z0, x1, z0, h, sd.n, k); wallLine(x0, z1, x1, z1, h, sd.s, k); wallLine(x0, z0, x0, z1, h, sd.w, k); wallLine(x1, z0, x1, z1, h, sd.e, k); if (roofK) P(roofK, (x0 + x1) / 2, (z0 + z1) / 2, x1 - x0 + .6, z1 - z0 + .6, h + .3, h) };
  // stairs from a platform edge point (ex,ez) going outward along (dx,dz), n steps up to height H
  const stairs = (ex, ez, dx, dz, n, wd, H) => { for (let i = 1; i <= n; i++) { const d = (n - i) * .5 + .25; P('step', ex + dx * d, ez + dz * d, dx ? .5 : wd, dz ? .5 : wd, i * H / n) } };
  // raised lookout ("peak") with railings + stairs
  const lookout = (x, z, dx, dz, roof) => {
    const H = 3.15; P('plat', x, z, 3.4, 3.4, H, H - .2);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) P('post', x + sx * 1.55, z + sz * 1.55, .2, .2, H - .2);
    for (const [sx, sz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      if (sx === dx && sz === dz) { if (sx) { P('railp', x + sx * 1.65, z - 1.15, .1, 1.1, H + 1, H); P('railp', x + sx * 1.65, z + 1.15, .1, 1.1, H + 1, H) } else { P('railp', x - 1.15, z + sz * 1.65, 1.1, .1, H + 1, H); P('railp', x + 1.15, z + sz * 1.65, 1.1, .1, H + 1, H) } continue }
      if (sx) P('railp', x + sx * 1.65, z, .1, 3.4, H + 1, H); else P('railp', x, z + sz * 1.65, 3.4, .1, H + 1, H)
    }
    stairs(x + dx * 1.7, z + dz * 1.7, dx, dz, 9, 1.2, H); if (roof) P('troof', x, z, 3.7, 3.7, H + 2.55, H + 2.35)
  };
  const lookouts = n => { let c = 0; for (let t = 0; t < 300 && c < n; t++) { const x = rr(-BX + 7, BX - 7), z = rr(-BZ + 7, BZ - 7), ax = Math.abs(x) > Math.abs(z), dx = ax ? -Math.sign(x) : 0, dz = ax ? 0 : -Math.sign(z);
    if (ok(x, z, 3.8, 3.8, 1.5) && ok(x + dx * 4.1, z + dz * 4.1, dx ? 4.8 : 1.8, dz ? 4.8 : 1.8, 1.2)) { lookout(x, z, dx, dz, R() < .5); c++ } } };

  // ------------------------------------------------------------------ generators
  if (id === 'base') {
    room(-9, -6, 9, 6, 6.5, { n: [[0, 9, 'gap']], s: [[0, 9, 'gap']], w: [[2, 1.6, 'door']], e: [[-2, 1.6, 'door']] }, 'hroof', 'metal');
    P('truck', -4, 1, 2.4, 6, 2.8); P('crate', 5, -3.4, 1.3, 1.3, 1.2); P('crate', 6.4, -3.4, 1.3, 1.3, 1.2); P('crate', 5.7, -3.4, 1.2, 1.2, 2.4, 1.2); P('cont', 4.6, 3.6, 6, 2.4, 2.6); P('barrel', -7.6, -4.6, .8, .8, 1); P('barrel', -7.6, -3.6, .8, .8, 1);
    for (const s of [-1, 1]) { const bx = s * 24, bz = s * 22;
      room(bx - 6, bz - 4, bx + 6, bz + 4, 3.2, { n: [[bx - 2.5, 1.6, s < 0 ? 'win' : 'door'], [bx + 3, 1.6, 'win']], s: [[bx - 3, 1.6, 'win'], [bx + 2.5, 1.6, s < 0 ? 'door' : 'win']], w: [[bz, 1.6, 'door']], e: [[bz, 1.6, 'win']] }, 'roofm', 'base');
      P('bunk', bx - 4.4, bz - 1.2, .9, 2, 1.6); P('bunk', bx + 4.4, bz + 1.2, .9, 2, 1.6); P('table', bx, bz, 1.6, .9, .8); P('bld', s * 24, -s * 22, 12, 8, 5) }
    lookout(33, 0, -1, 0, 1); lookout(-33, 0, 1, 0, 1); lookout(0, 33, 0, -1, 1); lookout(0, -33, 0, 1, 1);
    hides('bush', 10, 1.7, 1.7, 1.45);
    scatter('hesco', 12, () => ({ w: 3.2, d: 1.1, h: 1.6, rot: 1 }), 2.2); scatter('wall', 10, () => ({ w: 3, d: .8, h: 1.1, rot: 1 }), 2); scatter('crate', 12, () => ({ w: 1.3, d: 1.3, h: 1.2 }), 1.4);
    scatter('cont', 4, () => ({ w: 6, d: 2.5, h: 2.6, rot: 1 }), 2.6); scatter('barrel', 8, () => ({ w: .8, d: .8, h: 1 }), 1.2); scatter('truck', 2, () => ({ w: 2.4, d: 6, h: 2.8, rot: 1 }), 3);
  } else if (id === 'house') {
    wallLine(-14, -10, 14, -10, 3.2, [[-9, 1.6, 'door'], [-1, 1.6, 'win'], [3.5, 1.6, 'win'], [8, 1.6, 'door']], 'ext');
    wallLine(-14, 10, 14, 10, 3.2, [[-10, 1.6, 'win'], [-2, 1.6, 'door'], [9, 1.6, 'door'], [12.3, 1.4, 'win']], 'ext');
    wallLine(-14, -10, -14, 10, 3.2, [[-5, 1.6, 'win'], [5, 1.6, 'door']], 'ext');
    wallLine(14, -10, 14, 10, 3.2, [[-5, 1.6, 'door'], [5, 1.6, 'win']], 'ext');
    wallLine(-14, 0, 14, 0, 3.2, [[-9, 1.4, 'door'], [0, 1.4, 'door'], [9, 1.4, 'door']]);
    wallLine(-4, -10, -4, 0, 3.2, [[-5, 1.4, 'door']]); wallLine(4, 0, 4, 10, 3.2, [[5, 1.4, 'door']]);
    P('sofa', -9, -3, 2.4, .9, .85); P('table', -9, -5.3, 1.2, .7, .45); P('shelf', -13.4, -8.2, .5, 1.6, 2); P('tvstand', -10.5, -.6, 1.8, .5, 1.1);
    P('counter', 4.5, -5, 4, 1.2, 1); P('counter', 13.4, -2, .8, 3, 1); P('table', -1, -6, 2, 1.1, .8); P('fridge', -3.3, -8.9, .8, .8, 1.9);
    P('bed', -11, 7.4, 1.8, 2.2, .6); P('bed', -6.5, 7.4, 1.8, 2.2, .6); P('shelf', -13.4, 1.6, .6, 1.8, 2.1);
    P('bed', 11.5, 2.9, 1.8, 2.2, .6); P('table', 6, 8.4, 1.4, .7, .8); P('shelf', 6.5, .6, 1.6, .5, 2);
    P('plant', 12.6, -8.6, 1.1, 1.1, 1.7); P('plant', -2.6, 8.6, 1.1, 1.1, 1.7); P('plant', -12.6, -1.6, 1.1, 1.1, 1.7);
    P('roofh', 0, 0, 29.2, 21.2, 3.6, 3.2);
    room(18, 16, 24, 22, 2.6, { n: [[21, 1.4, 'door']], s: [], w: [], e: [[19, 1.4, 'win']] }, 'roofm', 'ext'); room(-24, -22, -18, -16, 2.6, { s: [[-21, 1.4, 'door']], n: [], w: [[-19, 1.4, 'win']], e: [] }, 'roofm', 'ext');
    P('car', -22, 14, 1.8, 3.8, 1.5); P('car', 22, -14, 1.8, 3.8, 1.5);
    hides('bush', 9, 1.7, 1.7, 1.45);
    scatter('hedge', 10, () => ({ w: 3, d: .8, h: 1.2, rot: 1 }), 2); scatter('tree', 8, () => ({ w: .8, d: .8, h: 8 }), 2.6); scatter('crate', 4, () => ({ w: 1.3, d: 1.3, h: 1.2 }), 1.5);
  } else if (id === 'office') {
    const H = 3.2;
    wallLine(-14, -20, -14, -10, H, [[-15, 1.6, 'door']], 'glass', .1); wallLine(-26, -10, -14, -10, H, [[-20, 1.6, 'door']], 'glass', .1); P('table', -20, -15, 4, 1.6, .78);
    wallLine(14, -20, 14, -10, H, [[-15, 1.6, 'door']], 'iw'); wallLine(14, -10, 26, -10, H, [[20, 1.6, 'door']], 'iw');
    P('srack', 18, -16, .9, 4.4, 2.1); P('srack', 22, -16, .9, 4.4, 2.1); P('srack', 25.2, -14, .9, 3, 2.1);
    wallLine(-14, 10, -14, 20, H, [[15, 1.6, 'door']], 'iw'); wallLine(-26, 10, -14, 10, H, [[-20, 1.6, 'door']], 'iw');
    P('counter', -20, 19.3, 6, .9, 1); P('fridge', -25.3, 18.6, .8, .8, 1.9); P('table', -20, 14.5, 1.8, 1.1, .78);
    wallLine(14, 10, 14, 20, H, [[15, 1.6, 'door']], 'glass', .1); wallLine(14, 10, 26, 10, H, [[20, 1.6, 'door']], 'glass', .1); P('table', 20, 15, 4, 1.6, .78);
    for (const cx of [-7, 7]) for (const cz of [-11, 0, 11]) {
      wallLine(cx - 3.2, cz, cx + 3.2, cz, 1.25, [], 'cube', .08); wallLine(cx, cz - 2.6, cx, cz + 2.6, 1.25, [], 'cube', .08);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) P('desk', cx + sx * 1.65, cz + sz * .5, 2.7, .75, .76, 0, { face: sz })
    }
    P('counter', 0, 0, 3.2, 1, 1.1); for (const [x, z] of [[-3.8, -6], [3.8, -6], [-3.8, 6], [3.8, 6]]) P('col', x, z, .6, .6, H);
    for (const [x, z] of [[-11.5, -4.5], [11.5, 4.5], [-11.5, 5], [11.5, -5], [0, -17.5], [0, 17.5], [-2.2, 9], [2.2, -9]]) P('plant', x, z, 1.1, 1.1, 1.7);
    P('ceil', 0, 0, BX * 2, BZ * 2, H + .3, H);
  } else if (id === 'warehouse') {
    for (const z of [-16, -9, 9, 16]) for (const x of [-17, 3]) P('prack', x, z, 14, 1.4, 5);
    P('cont', 28, -12, 6, 2.5, 2.6); P('cont', 28, 12, 6, 2.5, 5.2); P('truck', 27, 0, 6, 2.4, 2.8);
    P('forklift', -6, 2.2, 1.2, 2.6, 2.2); P('forklift', 11, -3, 1.2, 2.6, 2.2);
    // mezzanine office (raised platform) with stairs
    const MH = 3.15; P('plat', -28, -21.5, 10, 7, MH, MH - .2); for (const [x, z] of [[-32.8, -18.2], [-23.2, -18.2], [-28, -18.2]]) P('post', x, z, .25, .25, MH - .2);
    P('railp', -28, -18, 10, .1, MH + 1, MH); P('railp', -23, -23.4, .1, 3.2, MH + 1, MH); stairs(-22.95, -19.9, 1, 0, 9, 1.4, MH);
    P('desk', -30, -23.5, 2.7, .75, MH + .76, MH, { face: 1 }); P('crate', -31, -20, 1.3, 1.3, 1.2);
    P('plat', 28, 21.5, 10, 7, MH, MH - .2); for (const [x, z] of [[32.8, 18.2], [23.2, 18.2], [28, 18.2]]) P('post', x, z, .25, .25, MH - .2);
    P('railp', 28, 18, 10, .1, MH + 1, MH); P('railp', 23, 23.4, .1, 3.2, MH + 1, MH); stairs(22.95, 19.9, -1, 0, 9, 1.4, MH);
    for (const [x, z] of [[-25, -12.5], [12.5, 12.5], [-25, 12.5], [12.5, -12.5], [-7, -12.5], [-7, 12.5]]) P('strip', x, z, 1.4, 2.2, 2.4);
    scatter('crate', 10, () => ({ w: 1.3, d: 1.3, h: 1.2 }), 1.5); scatter('pallet', 8, () => ({ w: 1.3, d: 1.1, h: 1.6 }), 1.6); scatter('barrel', 6, () => ({ w: .8, d: .8, h: 1 }), 1.2);
    P('ceil', 0, 0, BX * 2, BZ * 2, 8.3, 8);
  } else if (id === 'bunker') {
    const H = 3;
    const D = [[-16, 2.2, 'door'], [0, 2.2, 'door'], [16, 2.2, 'door']];
    wallLine(-8, -24, -8, 24, H, D, 'conc', .5); wallLine(8, -24, 8, 24, H, D, 'conc', .5); wallLine(-24, -8, 24, -8, H, D, 'conc', .5); wallLine(-24, 8, 24, 8, H, D, 'conc', .5);
    P('table', 0, 0, 4, 2, .8); P('srack', 0, -6.8, 3, .7, 2.1); P('crate', -5.5, 5.5, 1.3, 1.3, 1.2); P('crate', 5.5, -5.5, 1.3, 1.3, 1.2);
    const cells = [[-16, -16], [0, -16], [16, -16], [-16, 0], [16, 0], [-16, 16], [0, 16], [16, 16]];
    cells.forEach(([cx, cz], i) => {
      const t = i % 4;
      if (t === 0) { P('bunk', cx - 5.3, cz - 4, .9, 2, 1.6); P('bunk', cx - 5.3, cz + 4, .9, 2, 1.6); P('locker', cx + 5.4, cz - 4.5, .6, 3, 2); P('locker', cx + 5.4, cz + 4.5, .6, 3, 2) }
      else if (t === 1) { P('crate', cx - 4.5, cz - 4.5, 1.3, 1.3, 1.2); P('crate', cx - 4.5, cz - 3.1, 1.3, 1.3, 1.2); P('crate', cx + 4.5, cz + 4.5, 1.3, 1.3, 1.2); P('barrel', cx + 5, cz - 5, .8, .8, 1); P('barrel', cx + 4, cz - 5, .8, .8, 1); P('pallet', cx - 4.6, cz + 4.6, 1.3, 1.1, 1.6) }
      else if (t === 2) { P('gen', cx - 4, cz - 4.5, 3, 1.6, 1.8); P('barrel', cx + 5, cz + 5, .8, .8, 1); P('barrel', cx + 5, cz + 4, .8, .8, 1); P('gen', cx + 4, cz - 4.5, 3, 1.6, 1.8) }
      else { P('locker', cx - 5.4, cz, .6, 4, 2); P('table', cx + 3, cz + 4.2, 2.2, 1, .85); P('crate', cx + 4.5, cz - 4.5, 1.3, 1.3, 1.2) }
      if (i % 2 === 0) P('strip', cx + (t === 2 ? -4.6 : 4.4), cz + (t === 2 ? 4.4 : -1.2), 1.4, 2, 2.4)
    });
    P('ceil', 0, 0, BX * 2, BZ * 2, H + .3, H);
  } else if (id === 'tunnel') {
    const X = [-21, -10.5, 0, 10.5, 21], Z = [-20, -11, 11, 20];
    for (const x of X) for (const z of Z) { if ((x === -10.5 && z === -11) || (x === 10.5 && z === 11) || (x === 0 && Math.abs(z) === 20)) continue; P('tblock', x, z, 6.5, 5, 4.6) }
    for (let x = -24.5; x <= 24.5; x += 7) { P('tpillar', x, 4.6, .9, .9, 4.6); P('tpillar', x, -4.6, .9, .9, 4.6) }
    P('train', -10, 0, 13, 3, 3.4); P('train', 12, .4, 9, 3, 3.4);
    for (const [x, z] of [[-10.5, -11], [10.5, 11], [0, -20], [0, 20]]) P('strip', x + 2, z, 1.4, 1.8, 2.4);
    scatter('crate', 12, () => ({ w: 1.3, d: 1.3, h: 1.2 }), 1.4); scatter('barrel', 10, () => ({ w: .8, d: .8, h: 1 }), 1.2); scatter('wall', 6, () => ({ w: 3, d: .7, h: 1.1, rot: 1 }), 2);
    P('ceil', 0, 0, 64, 64, 5.6, 4.6);
  } else if (id === 'bridge') {
    P('rail', -9.95, 0, .4, BZ * 2, 1.1); P('rail', 9.95, 0, .4, BZ * 2, 1.1);
    P('bus', -4, -8, 2.6, 10, 3.2); P('bus', 4, 8, 2.6, 10, 3.2); P('truck', 5, -26, 2.4, 6, 2.8); P('truck', -5, 26, 2.4, 6, 2.8);
    for (const s of [-1, 1]) { P('sand', -5, s * 44, 5, 1, 1.2); P('sand', 5, s * 44, 5, 1, 1.2) }
    for (const s of [-1, 1]) for (const z of [-34, -17, 17, 34]) P('bush', s * 8.4, z + s * 2, 1.6, 2.4, 1.4);
    scatter('car', 10, () => ({ w: 1.8, d: 3.8, h: 1.5 }), 1.6); scatter('wall', 12, () => ({ w: 3.2, d: .6, h: 1.1, rot: 1 }), 1.8); scatter('cont', 3, () => ({ w: 2.5, d: 6, h: 2.6 }), 2); scatter('crate', 6, () => ({ w: 1.3, d: 1.3, h: 1.2 }), 1.3);
  } else if (id === 'neon') {
    add('bld', -12.5, -12, 9, 8, rr(14, 22), 1); add('bld', 12.5, -12, 9, 8, rr(14, 22), 1); add('bld', -25, 0, 7, 6, rr(12, 18), 1); add('bld', 0, -25, 6, 7, rr(12, 18), 1);
    add('torii', -2.6, 0, .7, .7, 6, .2);
    hides('bush', 8, 1.6, 1.6, 1.45);
    scatter('car', 5, () => ({ w: 3.8, d: 1.8, h: 1.5, rot: 1 }), 2.2); scatter('vend', 6, () => ({ w: 1.2, d: .9, h: 2 }), 1.6);
    scatter('crate', 10, () => ({ w: 1.3, d: 1.3, h: 1.2 }), 1.4); scatter('wall', 8, () => ({ w: 3.2, d: .6, h: 1.1, rot: 1 }), 2);
  } else if (id === 'dune') {
    add('tower', 0, 0, 2.6, 2.6, 9, 2, false); lookouts(3);
    scatter('bld', 7, () => ({ w: rr(6, 9), d: rr(6, 9), h: rr(3.6, 5.6) }), 5); scatter('rock', 14, () => ({ w: rr(2, 5), d: rr(2, 5), h: rr(1.4, 3.5) }), 3);
    hides('bush', 12, 1.8, 1.8, 1.45);
    scatter('wall', 12, () => ({ w: 3.4, d: .9, h: 1.1, rot: 1 }), 2.5); scatter('crate', 12, () => ({ w: 1.3, d: 1.3, h: 1.2 }), 1.5);
    scatter('tree', 8, () => ({ w: .6, d: .6, h: 7 }), 3); scatter('car', 3, () => ({ w: 3.8, d: 1.8, h: 1.5, rot: 1 }), 3);
  } else if (id === 'frost') {
    add('bld', 0, 0, 5, 5, 3.4, 2, false); lookouts(2);
    scatter('bld', 5, () => ({ w: rr(6, 8), d: rr(4.5, 6), h: rr(3.6, 4.4), rot: 1 }), 4.5); scatter('cont', 6, () => ({ w: 6, d: 2.5, h: 2.6, rot: 1 }), 2.5);
    hides('bush', 12, 1.8, 1.8, 1.45);
    scatter('tree', 24, () => ({ w: .7, d: .7, h: 9 }), 2.4); scatter('rock', 8, () => ({ w: rr(2, 4), d: rr(2, 4), h: rr(1.2, 2.6) }), 2.5);
    scatter('wall', 8, () => ({ w: 3.4, d: .9, h: 1.1, rot: 1 }), 2.2); scatter('crate', 8, () => ({ w: 1.3, d: 1.3, h: 1.2 }), 1.5);
  } else if (id === 'harbor') {
    for (let gx = -30; gx <= 30; gx += 10) for (let gz = -28; gz <= 0; gz += 8) { if (R() < .3) continue; const rot = R() < .5, h = R() < .35 ? 5.2 : 2.6;
      const x = gx + rr(-2, 2), z = gz + rr(-1.5, 1.5); if (add('cont', x, z, rot ? 2.5 : 6, rot ? 6 : 2.5, h, 1.9) && R() < .55) add('crate', x + (rot ? 2 : 4), z + (rot ? 4 : 0), 1.3, 1.3, 1.2, .3) }
    lookouts(2); hides('bush', 8, 1.7, 1.7, 1.45);
    scatter('crate', 10, () => ({ w: 1.3, d: 1.3, h: 1.2 }), 1.4); scatter('wall', 8, () => ({ w: 3.2, d: .6, h: 1.1, rot: 1 }), 2); scatter('car', 2, () => ({ w: 3.8, d: 1.8, h: 1.5, rot: 1 }), 2.5);
  } else if (id === 'ruins') {
    add('bld', 0, 0, 6, 6, 2.8, 2, false);
    for (let i = 0; i < 4; i++) add('pillar', [-5, 5, -5, 5][i], [-5, -5, 5, 5][i], 1.2, 1.2, 5, .3, false);
    lookouts(2); hides('bush', 14, 1.8, 1.8, 1.45);
    scatter('wall', 16, () => ({ w: rr(4, 8), d: .9, h: rr(1.2, 3.6), rot: 1 }), 2.6); scatter('pillar', 10, () => ({ w: 1.2, d: 1.2, h: rr(2.5, 6) }), 2.5);
    scatter('tree', 22, () => ({ w: .8, d: .8, h: 10 }), 2.6); scatter('rock', 10, () => ({ w: rr(2, 4.5), d: rr(2, 4.5), h: rr(1.2, 3) }), 2.5);
  }

  W.COL = L.filter(b => !HIDE_KINDS.has(b.k)).map(b => { const tw = b.k === 'tree' ? .35 : 1;
    return { x0: b.x - b.w / 2 * tw, x1: b.x + b.w / 2 * tw, z0: b.z - b.d / 2 * tw, z1: b.z + b.d / 2 * tw, y0: b.y0 || 0, y1: b.h, nb: SOFT_BULLET.has(b.k) } });
  W.HIDE = L.filter(b => HIDE_KINDS.has(b.k)).map(b => ({ x0: b.x - b.w / 2, x1: b.x + b.w / 2, z0: b.z - b.d / 2, z1: b.z + b.d / 2 }));
  buildNav();
  const fix = pts => pts.map(s => nearestFree(s[0], s[1]) || s);
  W.SP_FFA = fix(SP_FFA); W.SP_T = [fix(SP_T[0]), fix(SP_T[1])];
}

// ---------------- bot navigation grid (1m cells, BFS paths) ----------------
const CS = .5; // nav cell size (m)
function buildNav() {
  const { BX, BZ } = W, nx = Math.ceil(BX * 2 / CS), nz = Math.ceil(BZ * 2 / CS), g = new Uint8Array(nx * nz), free = [], pad = PR + .02;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = -BX + (i + .5) * CS, z = -BZ + (j + .5) * CS; let b = Math.abs(x) > BX - .6 || Math.abs(z) > BZ - .6 ? 1 : 0;
    if (!b) for (const c of W.COL) { if (c.y0 > 1.7 || c.y1 <= STEP) continue; if (x > c.x0 - pad && x < c.x1 + pad && z > c.z0 - pad && z < c.z1 + pad) { b = 1; break } }
    g[i + j * nx] = b; if (!b) free.push(i + j * nx)
  }
  W.NAV = { nx, nz, g, free, par: new Int32Array(nx * nz), q: new Int32Array(nx * nz) }
}
export const cellI = (x, z) => { const N = W.NAV, i = clamp(Math.floor((x + W.BX) / CS), 0, N.nx - 1), j = clamp(Math.floor((z + W.BZ) / CS), 0, N.nz - 1); return i + j * N.nx };
export const cellXZ = c => [-W.BX + ((c % W.NAV.nx) + .5) * CS, -W.BZ + (Math.floor(c / W.NAV.nx) + .5) * CS];
export function nearestFree(x, z) { const c0 = cellI(x, z); if (!W.NAV.g[c0]) return cellXZ(c0); let best = null, bd = 1e9; for (const c of W.NAV.free) { const [cx, cz] = cellXZ(c), d = (cx - x) ** 2 + (cz - z) ** 2; if (d < bd) { bd = d; best = [cx, cz] } } return best }
export function findPath(sx, sz, tx, tz) {
  const N = W.NAV; let s = cellI(sx, sz), t = cellI(tx, tz);
  if (N.g[t]) { const f = nearestFree(tx, tz); if (!f) return null; t = cellI(f[0], f[1]) }
  if (N.g[s]) { const f = nearestFree(sx, sz); if (!f) return null; s = cellI(f[0], f[1]) }
  N.par.fill(-1); let h = 0, e = 0; N.q[e++] = s; N.par[s] = s; const nx = N.nx;
  while (h < e) { const c = N.q[h++]; if (c === t) break; const i = c % nx, j = (c / nx) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { if (!di && !dj) continue; const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= nx || nj >= N.nz) continue; const n = ni + nj * nx; if (N.g[n] || N.par[n] >= 0) continue;
      if (di && dj && (N.g[i + di + j * nx] || N.g[i + (j + dj) * nx])) continue; N.par[n] = c; N.q[e++] = n } }
  if (N.par[t] < 0) return null; const path = []; let c = t; while (c !== s) { path.push(cellXZ(c)); c = N.par[c] } path.reverse(); return path
}
export function walkable(ax, az, bx, bz) { const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / .25); for (let i = 1; i <= n; i++) { const t = i / n; if (W.NAV.g[cellI(ax + (bx - ax) * t, az + (bz - az) * t)]) return false } return true }
