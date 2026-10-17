// =====================================================================
//  HOST: authoritative lobby + match simulation (runs in the host's tab)
// =====================================================================
import { S, saveS, CLS, CK, GG, MODES, MAPS, PALETTE, TEAMC, TEAMN, BOT_NAMES, DIFF, EYE, CEYE, SPEED } from '../config.js';
import { clamp, rnd, r2, angDiff } from '../util.js';
import { W, findPath, walkable, cellXZ } from '../world/layout.js';
import { moveCircle, rayWorld, raySphere, dirOf, losPts, hitSpheres, eyePos, concealed } from '../world/physics.js';
import { buildWorld } from '../render/world.js';
import { NET, GS } from '../state.js';
import { toast, onChat, renderLobby } from '../ui/menu.js';
import { onSnap, enterGame, showLobby, localInput } from './client.js';

export function newPlayer(id, name, col, bot, cls) {
  return { id, name: name.slice(0, 14), col, team: 0, ready: false, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, lean: 0, hp: 100, alive: false, resAt: 0, shUntil: 0, cls, next: cls, ammo: CLS[cls].mag, rlUntil: 0, last: 0, lastShot: 0,
    k: 0, d: 0, st: 0, sp: 0, ads: false, cr: false, lastHurt: 0, autoRl: true, pwK: null, pwUntil: 0, pwReady: 0, inp: { sh: false, rl: false }, bot, b: bot ? { path: null, pi: 0, wpT: 0, seen: 0, strafe: 1, stT: 0, stuck: 0, last: null, jit: Math.random() * 10, ads: false } : null }
}
// ---------------- lobby ----------------
export function hostCreate(online) {
  const now = performance.now();
  GS.G = { phase: 'lobby', players: new Map(), cfg: { map: MAPS[S.lastMap] ? S.lastMap : 'base', mode: MODES[S.lastMode] ? S.lastMode : 'ffa', time: S.lastTime || 5, bots: online ? 0 : 4, diff: S.lastDiff || 'normal', aim: S.lastAim || 'manual', fire: S.lastFire || 'manual' }, ev: [], tick: 0, lt: now, ts: [0, 0], winner: '', online, endAt: 0, resetAt: 0 };
  const G = GS.G; if (G.cfg.mode === 'duel') G.cfg.bots = Math.min(G.cfg.bots, 1);
  NET.myId = 0; const p = newPlayer(0, S.name || 'ghost', S.col, false, S.cls); p.ready = true; G.players.set(0, p);
  syncBots(); GS.LB = lobbyState(); showLobby(); renderLobby(GS.LB);
  hostSys(online ? `Private room ${NET.room} created. Only people with this code can join.` : 'Practice lobby. Pick a map & mode, then START MATCH.');
  setInterval(hostTick, 1000 / 60)
}
export function lobbyState() { const G = GS.G; return { t: 'lb', room: NET.room, host: 0, cfg: { ...G.cfg }, pl: [...G.players.values()].map(p => [p.id, p.name, p.col, p.team, p.ready ? 1 : 0, p.bot ? 1 : 0, p.cls]) } }
let lastLbStr = '';
export function broadcastLobby(force) { const st = lobbyState(); for (const c of NET.conns.values()) if (c.open) { try { c.send(st) } catch (e) { } } const s = JSON.stringify(st); if (force || s !== lastLbStr) { lastLbStr = s; if (!GS.inGame) renderLobby(st) } }
export function pickTeam(ex) { const c = [0, 0]; for (const p of GS.G.players.values()) if (p !== ex) c[p.team]++; return c[0] <= c[1] ? 0 : 1 }
export function syncBots() {
  const G = GS.G, mode = MODES[G.cfg.mode], humans = [...G.players.values()].filter(p => !p.bot); let bots = [...G.players.values()].filter(p => p.bot);
  if (mode.max === 2) humans.forEach((p, i) => p.team = i % 2);
  const want = clamp(G.cfg.bots, 0, Math.max(0, mode.max - humans.length));
  while (bots.length > want) { const b = bots.pop(); G.players.delete(b.id) } while (bots.length < want) bots.push(addBot());
  if (mode.max === 2 && bots[0] && humans[0]) bots[0].team = 1 - humans[0].team
}
function addBot() { const G = GS.G, used = [...G.players.values()].map(p => p.name), nm = BOT_NAMES.find(n => !used.includes(n)) || 'bot' + GS.nextId; const id = GS.nextId++, cls = CK[Math.random() * CK.length | 0]; const p = newPlayer(id, nm, PALETTE[Math.random() * PALETTE.length | 0], true, cls); p.ready = true; p.team = pickTeam(); G.players.set(id, p); return p }
export function hostSetCfg(k, v) {
  const G = GS.G; if (!G || G.phase !== 'lobby') return; G.cfg[k] = v;
  if (k === 'mode') { S.lastMode = v; if (v === 'duel') G.cfg.bots = Math.min(G.cfg.bots, 1) }
  if (k === 'map') S.lastMap = v; if (k === 'diff') S.lastDiff = v; if (k === 'aim') S.lastAim = v; if (k === 'fire') S.lastFire = v; if (k === 'time') S.lastTime = v;
  saveS(); syncBots(); broadcastLobby(true)
}
export function hostSwitch(id) { const G = GS.G; if (!G || G.phase !== 'lobby') return; const mode = MODES[G.cfg.mode]; if (!mode.teams) return; const p = G.players.get(id); if (!p) return; const t = 1 - p.team; if (mode.max === 2) { const o = [...G.players.values()].find(q => q !== p && q.team === t); if (o) o.team = p.team } p.team = t; broadcastLobby(true) }
export function hostChat(id, m) { const p = GS.G && GS.G.players.get(id); if (!p) return; const msg = { t: 'c', n: p.name, c: p.col, m: String(m).slice(0, 120) }; for (const c of NET.conns.values()) if (c.open) c.send(msg); onChat(msg) }
export function hostSys(text) { const msg = { t: 'c', sys: text }; for (const c of NET.conns.values()) if (c.open) c.send(msg); onChat(msg) }
export function hostStart() {
  const G = GS.G; if (!G || G.phase !== 'lobby') return; const total = G.players.size, mode = MODES[G.cfg.mode];
  if (G.cfg.mode === 'duel' && total !== 2) { toast('1v1 needs exactly 2 players — wait for a friend or add 1 bot'); return }
  if (total < 2) { toast('Need at least 2 players — invite friends or add bots'); return }
  if (total > mode.max) { toast('Too many players for ' + mode.n); return }
  if (mode.teams && [0, 1].some(t => ![...G.players.values()].some(p => p.team === t))) { toast('Both teams need at least one player'); return }
  const notReady = [...G.players.values()].filter(p => !p.bot && !p.ready && p.id !== NET.myId);
  if (notReady.length && !confirm(notReady.map(p => p.name).join(', ') + ' not ready. Start anyway?')) return;
  const now = performance.now(); G.phase = 'play'; G.ts = [0, 0]; G.endAt = now + G.cfg.time * 60000; G.ev = []; G.winner = '';
  buildWorld(G.cfg.map);
  for (const p of G.players.values()) { p.k = p.d = p.st = 0; p.alive = false; p.pwReady = now + 6000; p.pwUntil = 0; if (p.bot) { p.b.path = null; p.b.last = null } } for (const p of G.players.values()) spawn(p, now);
  const go = { t: 'go', map: G.cfg.map, mode: G.cfg.mode, aim: G.cfg.aim, fire: G.cfg.fire }; for (const c of NET.conns.values()) if (c.open) c.send(go);
  hostSys('Match started — ' + mode.n + ' on ' + MAPS[G.cfg.map].name); enterGame(go)
}
function hostBackToLobby() { const G = GS.G; G.phase = 'lobby'; for (const p of G.players.values()) { p.alive = false; p.ready = p.bot || p.id === NET.myId; p.k = p.d = p.st = 0 } showLobby(); lastLbStr = ''; broadcastLobby(true) }

// ---------------- match sim ----------------
const sameTeam = (a, b) => MODES[GS.G.cfg.mode].teams && a.team === b.team;
function forcedCls(p) { const m = GS.G.cfg.mode; if (m === 'gun') return GG[Math.min(4, Math.floor(p.k / 2))]; if (m === 'snipe') return 'sniper'; return null }
const pwOn = (p, k, now) => p.pwK === k && p.cls === k && now < p.pwUntil;
function activatePower(p, now) { if (!p.alive || now < p.pwReady) return; const P = CLS[p.cls].pw; p.pwK = p.cls; p.pwUntil = now + P.dur * 1000; p.pwReady = now + P.cd * 1000; GS.G.ev.push(['pw', p.id, CK.indexOf(p.cls)]) }
export function spawn(p, now) {
  const G = GS.G, pool = MODES[G.cfg.mode].teams ? W.SP_T[p.team] : W.SP_FFA; let best = pool[0], bd = -1;
  for (const s of pool) { let md = 1e9; for (const o of G.players.values()) if (o !== p && o.alive && !sameTeam(o, p)) md = Math.min(md, Math.hypot(o.x - s[0], o.z - s[1])); md += Math.random() * 8; if (md > bd) { bd = md; best = s } }
  p.x = best[0] + rnd(-.4, .4); p.z = best[1] + rnd(-.4, .4); p.y = 0; p.yaw = Math.atan2(p.x, p.z); p.pitch = 0; p.lean = 0; p.hp = 100; p.alive = true; p.shUntil = now + 2000;
  p.cls = forcedCls(p) || (CLS[p.next] ? p.next : 'ar'); p.ammo = CLS[p.cls].mag; p.rlUntil = 0; p.sp++; p.inp.sh = false; p.lastHurt = 0; p.pwUntil = 0; if (p.bot) { p.b.path = null; p.b.stuck = 0 }
}
export function applyInput(p, i) {
  const G = GS.G; if (typeof i.x !== 'number') return; const now = performance.now();
  if (p.alive && i.sp === p.sp) {
    const nx = clamp(i.x, -W.BX, W.BX), nz = clamp(i.z, -W.BZ, W.BZ);
    if (p.id === NET.myId || Math.hypot(nx - p.x, nz - p.z) < 3) { p.x = nx; p.y = clamp(i.y, 0, 14); p.z = nz } // simple anti-teleport
  }
  if (typeof i.yw === 'number') { p.yaw = i.yw; p.pitch = clamp(i.pt, -1.5, 1.5) } p.lean = clamp(+i.ln || 0, -1, 1);
  p.inp.sh = !!i.sh; p.ads = !!i.ad; p.cr = !!i.cr; p.autoRl = i.ar !== 0; if (i.rl) p.inp.rl = true; if (CLS[i.cls]) p.next = i.cls;
  if (i.pw && G.phase === 'play') activatePower(p, now);
  if (i.rs && !p.alive && G.phase === 'play' && now >= p.resAt) spawn(p, now)
}
function startReload(p, now) { if (p.rlUntil || p.ammo >= CLS[p.cls].mag) return; p.rlUntil = now + CLS[p.cls].rl }
function fire(p, now) {
  const G = GS.G, W2 = CLS[p.cls]; p.last = now; p.lastShot = now; const oc = pwOn(p, 'ar', now), dr = pwOn(p, 'shotgun', now), pi = pwOn(p, 'dmr', now), de = pwOn(p, 'sniper', now); if (!oc) p.ammo--; p.shUntil = 0;
  const o = eyePos(p.x, p.y, p.z, p.yaw, p.cr ? CEYE : EYE, p.lean), hits = [];
  let spr = p.ads ? W2.adsSpr : W2.spr; if (p.cr) spr *= .75; if (p.bot) spr = (p.b.ads ? W2.adsSpr : W2.spr) + DIFF[G.cfg.diff].acc; if (oc) spr *= .5; if (dr) spr *= .6;
  for (let i = 0; i < W2.pel; i++) {
    const d = dirOf(p.yaw + (Math.random() - .5) * 2 * spr, p.pitch + (Math.random() - .5) * 2 * spr), tw = rayWorld(o, d, W2.maxR, true); let t = pi ? W2.maxR : tw, hp = null, head = 0;
    for (const q of G.players.values()) { if (q === p || !q.alive || sameTeam(p, q)) continue; for (const [cx, cy, cz, r, isH] of hitSpheres(q.x, q.y, q.z, q.yaw, q.cr, q.lean)) { const tt = raySphere(o, d, cx, cy, cz, r); if (tt > 0 && tt < t) { t = tt; hp = q; head = isH } } }
    if (!hp) t = tw; hits.push([r2(o[0] + d[0] * t), r2(o[1] + d[1] * t), r2(o[2] + d[2] * t), hp ? (head ? 2 : 1) : (t < W2.maxR - .1 ? 3 : 0)]);
    if (hp) { let dmg = W2.dmg * (head ? W2.hs : 1); if (W2.fall) dmg *= clamp(1.2 - t / W2.maxR, .3, 1); if (dr) dmg *= 1.5; if (pi) dmg *= 1.15; if (de) dmg *= 1.25; damage(hp, p, dmg, head, now) }
  }
  G.ev.push(['shot', p.id, CK.indexOf(p.cls), r2(o[0]), r2(o[1]), r2(o[2]), hits, oc ? 1 : dr ? 2 : pi ? 3 : 0])
}
function weaponLogic(p, now) {
  const W2 = CLS[p.cls]; if (p.rlUntil && now >= p.rlUntil) { p.ammo = W2.mag; p.rlUntil = 0 } if (p.inp.rl) { p.inp.rl = false; startReload(p, now) }
  const rate = W2.rate * (pwOn(p, 'smg', now) ? .7 : 1);
  if (p.inp.sh && !p.rlUntil && now - p.last >= rate) { if (p.ammo > 0) fire(p, now); else startReload(p, now) }
  if (p.ammo === 0 && !p.rlUntil && (p.bot || p.autoRl)) startReload(p, now)
}
const dispC = p => MODES[GS.G.cfg.mode].teams ? TEAMC[p.team] : p.col;
function damage(v, a, dmg, head, now) {
  const G = GS.G; if (!v.alive || now < v.shUntil) return; dmg = Math.round(dmg); v.hp -= dmg; v.lastHurt = now;
  G.ev.push(['hit', v.id, a.id, dmg, head ? 1 : 0, r2(v.x), r2(v.y + 1.2), r2(v.z)]);
  if (v.bot && !v.b.last) v.b.last = [a.x, a.z];
  if (v.hp <= 0) {
    v.hp = 0; v.alive = false; v.resAt = now + 2500; v.d++; v.st = 0; v.rlUntil = 0; v.inp.sh = false; v.pwUntil = 0; a.k++; a.st++; if (MODES[G.cfg.mode].teams) G.ts[a.team]++;
    G.ev.push(['kill', a.name, dispC(a), v.name, dispC(v), a.cls, a.id, v.id, a.st, head ? 1 : 0, r2(v.x), r2(v.y + 1), r2(v.z), a.ads ? 1 : 0]);
    if (G.cfg.mode === 'gun' && a.alive) { const nc = forcedCls(a); if (nc !== a.cls) { a.cls = nc; a.ammo = CLS[nc].mag; a.rlUntil = 0; G.ev.push(['lvl', a.id, nc, Math.min(5, Math.floor(a.k / 2) + 1)]) } }
  }
}
// ---------------- bots ----------------
function botGoal(p, now) {
  const B = p.b; let g = null;
  if (B.last) { g = B.last; B.last = null }
  else if (Math.random() < .55) { let bd = 1e9; for (const o of GS.G.players.values()) { if (o === p || !o.alive || sameTeam(o, p)) continue; const d = Math.hypot(o.x - p.x, o.z - p.z); if (d < bd) { bd = d; g = [o.x + rnd(-4, 4), o.z + rnd(-4, 4)] } } }
  if (!g) g = cellXZ(W.NAV.free[Math.random() * W.NAV.free.length | 0]);
  B.path = findPath(p.x, p.z, g[0], g[1]); B.pi = 0; B.wpT = now + 9000
}
function botThink(p, dt, now) {
  const G = GS.G, B = p.b, D = DIFF[G.cfg.diff], W2 = CLS[p.cls]; let tgt = null, td = 1e9;
  for (const o of G.players.values()) { if (o === p || !o.alive || sameTeam(o, p)) continue; const d = Math.hypot(o.x - p.x, o.z - p.z); if (d > 70 || d >= td) continue;
    if (concealed(o.x, o.z, p.x, p.z, o.lastShot, now)) continue;
    const hs = hitSpheres(o.x, o.y, o.z, o.yaw, o.cr, o.lean); if (losPts(p.x, p.y + EYE, p.z, hs[1][0], hs[1][1], hs[1][2]) || losPts(p.x, p.y + EYE, p.z, hs[0][0], hs[0][1], hs[0][2])) { td = d; tgt = o } }
  let mx = 0, mz = 0;
  if (tgt) {
    B.seen += dt; B.last = [tgt.x, tgt.z]; B.path = null; const dx = tgt.x - p.x, dz = tgt.z - p.z, err = D.err * (Math.sin(now / 260 + B.jit) + .6 * Math.sin(now / 97 + B.jit * 3)) * (1 + Math.min(1, 1 / (B.seen + .3)));
    const ty = Math.atan2(-dx, -dz) + err, tp = Math.atan2(tgt.y + 1.3 - (p.y + EYE), Math.hypot(dx, dz)) + err * .6;
    const dy = angDiff(ty, p.yaw); p.yaw += dy * Math.min(1, dt * 10); p.pitch += (tp - p.pitch) * Math.min(1, dt * 10);
    const ideal = p.cls === 'shotgun' ? 5 : p.cls === 'smg' ? 9 : p.cls === 'ar' ? 16 : 30, f = td > ideal + 3 ? 1 : td < ideal - 3 ? -.7 : 0;
    B.stT -= dt; if (B.stT <= 0) { B.strafe = Math.random() < .5 ? -1 : 1; B.stT = rnd(.4, 1.4) }
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw); mx = fx * f + (-fz) * B.strafe * .85; mz = fz * f + fx * B.strafe * .85;
    B.ads = !!W2.scope && td > 12; p.ads = B.ads; p.inp.sh = B.seen > D.react && td < W2.maxR * .85 && Math.abs(dy) < .25;
    if (B.seen > .7 && now >= p.pwReady && Math.random() < dt * .6) activatePower(p, now)
  } else {
    B.seen = Math.max(0, B.seen - dt * 2); p.inp.sh = false; p.ads = false; B.ads = false;
    if (!B.path || B.pi >= B.path.length || now > B.wpT) botGoal(p, now);
    if (B.path && B.pi < B.path.length) {
      for (let j = Math.min(B.pi + 12, B.path.length - 1); j > B.pi; j--) if (walkable(p.x, p.z, B.path[j][0], B.path[j][1])) { B.pi = j; break }
      const n = B.path[B.pi], dx = n[0] - p.x, dz = n[1] - p.z, L = Math.hypot(dx, dz); if (L < .35) B.pi++; else { mx = dx / L; mz = dz / L }
      const tyw = Math.atan2(-(mx || 1e-6), -(mz || 1e-6)); p.yaw += angDiff(tyw, p.yaw) * Math.min(1, dt * 6); p.pitch *= .9
    }
    if (p.ammo < CLS[p.cls].mag * .5) p.inp.rl = true
  }
  const l = Math.hypot(mx, mz); if (l < .01) return; const sp = SPEED * .88 * W2.spd * D.move * (B.ads ? .6 : 1) * (pwOn(p, 'smg', now) ? 1.3 : 1) * dt, ox = p.x, oz = p.z; moveCircle(p, mx / l * sp, mz / l * sp);
  if (Math.hypot(p.x - ox, p.z - oz) < sp * .3) { B.stuck += dt; B.strafe *= -1; if (B.stuck > .5) { B.stuck = 0; B.path = null } } else B.stuck = 0
}
// ---------------- main tick (60 Hz) ----------------
function hostTick() {
  const G = GS.G, now = performance.now(), dt = Math.min(.05, (now - G.lt) / 1000) || 1 / 60; G.lt = now; G.tick++;
  if (G.phase === 'lobby') { if (G.tick % 15 === 0) broadcastLobby(); return }
  const mine = G.players.get(NET.myId); if (mine && GS.inGame) applyInput(mine, localInput());
  if (G.phase === 'play') {
    for (const p of G.players.values()) {
      if (!p.alive) { if (p.bot && now >= p.resAt + 800) { if (!forcedCls(p) && Math.random() < .25) p.next = CK[Math.random() * 5 | 0]; spawn(p, now) } else if (!p.bot && now >= p.resAt + 12000) spawn(p, now); continue }
      if (p.bot) botThink(p, dt, now); weaponLogic(p, now); if (p.hp < 100 && now - p.lastHurt > 5000) p.hp = Math.min(100, p.hp + 30 * dt)
    }
    const mode = MODES[G.cfg.mode]; let top = null; for (const p of G.players.values()) if (!top || p.k > top.k) top = p;
    const won = mode.teams ? Math.max(...G.ts) >= mode.goal : (top && top.k >= mode.goal);
    if (won || now >= G.endAt) { G.phase = 'end'; G.resetAt = now + 9000; let wt = -1;
      if (mode.teams) { if (G.ts[0] === G.ts[1]) G.winner = 'DRAW'; else { wt = G.ts[0] > G.ts[1] ? 0 : 1; G.winner = G.cfg.mode === 'duel' ? ([...G.players.values()].find(p => p.team === wt) || { name: '?' }).name : 'TEAM ' + TEAMN[wt] } }
      else G.winner = top ? top.name : '-';
      G.ev.push(['end', G.winner, wt, mode.teams ? -1 : (top ? top.id : -1)]) }
  } else if (G.phase === 'end' && now >= G.resetAt) { broadcast(now); hostBackToLobby(); return }
  if (G.tick % 2 === 0) broadcast(now)
}
function broadcast(now) {
  const G = GS.G, s = { t: 's', ph: G.phase, tm: Math.max(0, ((G.phase === 'play' ? G.endAt : G.resetAt) - now) / 1000 | 0), win: G.winner, mode: G.cfg.mode, aim: G.cfg.aim, fire: G.cfg.fire, ts: G.ts, p: [], ev: G.ev };
  for (const p of G.players.values()) { const act = p.pwK && p.pwK === p.cls && now < p.pwUntil;
    s.p.push([p.id, p.name, p.col, p.team, r2(p.x), r2(p.y), r2(p.z), +p.yaw.toFixed(3), +p.pitch.toFixed(3), Math.ceil(p.hp), p.alive ? 1 : 0, p.cls, p.ammo,
      p.rlUntil ? r2(Math.max(0, (p.rlUntil - now) / CLS[p.cls].rl)) : 0, p.k, p.d, now < p.shUntil ? 1 : 0, p.sp, p.alive ? 0 : Math.max(0, Math.ceil((p.resAt - now) / 1000)), p.st, p.ads ? 1 : 0, p.cr ? 1 : 0,
      act ? Math.round((p.pwUntil - now) / 100) / 10 : 0, Math.max(0, Math.round((p.pwReady - now) / 100) / 10), act ? CK.indexOf(p.pwK) : -1, r2(p.lean)]) }
  G.ev = []; for (const c of NET.conns.values()) if (c.open) { try { c.send(s) } catch (e) { } } if (GS.inGame) onSnap(s)
}
