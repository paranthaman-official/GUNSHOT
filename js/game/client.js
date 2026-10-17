// =====================================================================
//  CLIENT: local movement prediction, snapshots, effects, camera, HUD, render loop
// =====================================================================
import * as THREE from 'three';
import { S, ST, saveST, CLS, CK, MODES, MAPS, TEAMC, TEAMN, EYE, CEYE, SEYE, SPEED, GRAV, JUMP, HEAD, LEAN } from '../config.js';
import { $, clamp, rnd, r2, esc, isTouch, angDiff, keyLabel } from '../util.js';
import { W } from '../world/layout.js';
import { moveCircle, floorAt, ceilAt, rayWorld, raySphere, dirOf, losPts, hitSpheres, inHide, concealed } from '../world/physics.js';
import { renderer, scene, camera, cv, MED, Q, ctex } from '../render/renderer.js';
import { buildWorld, updFx } from '../render/world.js';
import { vmRoot, VM, flashLight, makePlayer, setPlayerGun, setTag } from '../render/guns.js';
import { burst, updParticles, tracer, updTracers, addDecal, clearDecals, hitNormal } from '../render/fx.js';
import { tone, noise, sfxShot } from '../audio.js';
import { NET, GS, R, me } from '../state.js';
import { IN, act, resetTouch } from '../input.js';
import { closeModal, openModal, toast, applySettings, renderLobby } from '../ui/menu.js';
import { fillAds, interstitial } from '../ui/ads.js';

const meshes = new Map(), lastShotAt = new Map(); let meMesh = null;
let hitMarkT = 0, hurt = 0, shake = 0, flashT = 0, curVM = '', autoTarget = false, aimedId = -1, aimedT = 0;
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _v = new THREE.Vector3();
export const myP = () => R.players.get(NET.myId);
const isTeamMode = () => MODES[R.mode] && MODES[R.mode].teams;
const isEnemy = p => { const m = myP(); if (!m || p.id === NET.myId) return false; return !isTeamMode() || p.team !== m.team };
const dispCol = p => isTeamMode() ? TEAMC[p.team] : p.col;

// ---------------- screens ----------------
export function enterGame(go) {
  R.mode = go.mode; R.aim = go.aim || 'manual'; R.fire = go.fire || 'manual';
  GS.inGame = true; GS.paused = false; $('menu').classList.add('hidden'); $('lobby').classList.add('hidden'); $('hud').classList.remove('hidden'); document.body.classList.add('ingame');
  $('roomChip').innerHTML = NET.room ? `<span class="dot"></span>ROOM ${NET.room}` : '<span class="dot" style="background:var(--gold)"></span>PRACTICE';
  $('modeL').textContent = MODES[R.mode].n.toUpperCase(); const tm = isTeamMode(); $('tsA').classList.toggle('hidden', !tm); $('tsB').classList.toggle('hidden', !tm);
  $('chatHint').textContent = `[${keyLabel(S.keys.chat)}] chat · [${keyLabel(S.keys.power)}] power · [${keyLabel(S.keys.leanL)}/${keyLabel(S.keys.leanR)}] peek`;
  if (!meMesh) meMesh = makePlayer(S.col); meMesh.userData.tag.visible = false; me.sp = -1;
  if (isTouch) { $('mob').classList.remove('hidden'); resetTouch(); try { document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => { })).catch(() => { }) } catch (e) { } }
  else cv.requestPointerLock && cv.requestPointerLock();
  const assist = R.aim === 'manual' && R.fire === 'manual' ? 'ALL MANUAL' : (R.aim !== 'manual' ? R.aim.toUpperCase() + ' AIM' : '') + (R.fire === 'auto' ? ' · AUTO-FIRE' : '');
  announce('GO GO GO', MODES[R.mode].n.toUpperCase() + ' · ' + MAPS[W.MAPID].name + ' · ' + assist, '#ffb23f')
}
export function showLobby() {
  const wasIn = GS.inGame; GS.inGame = false; document.body.classList.remove('ingame');
  $('menu').classList.add('hidden'); $('hud').classList.add('hidden'); $('death').classList.add('hidden'); $('lobby').classList.remove('hidden');
  closeModal('pause'); if (document.pointerLockElement) document.exitPointerLock();
  for (const m of meshes.values()) scene.remove(m); meshes.clear(); R.players.clear(); if (meMesh) meMesh.visible = false; vmRoot.visible = false; clearDecals();
  if (GS.LB && GS.LB.cfg && GS.LB.cfg.map !== W.MAPID) buildWorld(GS.LB.cfg.map);
  if (wasIn) interstitial('match-end'); setTimeout(() => fillAds($('lobby')), 300)
}

// ---------------- snapshots ----------------
export function onSnap(s) {
  if (!GS.inGame) return; R.tm = s.tm; R.win = s.win; R.phase = s.ph; R.mode = s.mode; R.ts = s.ts; R.aim = s.aim || R.aim; R.fire = s.fire || R.fire; const seen = new Set();
  for (const a of s.p) {
    const [id, name, col, team, x, y, z, yaw, pitch, hp, alive, cls, ammo, rl, k, d, sh, sp, resIn, st, ads, cr, pwA, pwC, pwK, ln] = a; seen.add(id);
    let p = R.players.get(id); if (!p) { p = { rx: x, ry: y, rz: z, ryaw: yaw, rln: 0 }; R.players.set(id, p) }
    if (sp !== p.sp) { p.rx = x; p.ry = y; p.rz = z }
    Object.assign(p, { id, name, col, team, x, y, z, yaw, pitch, hp, alive: !!alive, cls, ammo, rl, k, d, sh: !!sh, sp, resIn, st, ads: !!ads, cr: !!cr, pwA, pwC, pwK: pwK >= 0 ? CK[pwK] : null, lean: ln || 0 });
    if (id === NET.myId) {
      if (sp !== me.sp) { me.x = x; me.y = y; me.z = z; me.yaw = yaw; me.pitch = 0; me.vx = me.vz = me.vy = 0; me.sp = sp; me.ads = false; me.zl = 0; me.slideT = 0; me.crouch = false; me.lean = 0; me.hintUntil = CLS[cls].scope ? performance.now() + 6000 : 0; $('death').classList.add('hidden') }
      if (meMesh && meMesh.userData.col !== dispCol(p)) { meMesh.userData.band.color.set(dispCol(p)); meMesh.userData.col = dispCol(p) }
    } else {
      let m = meshes.get(id); if (!m) { m = makePlayer(dispCol(p)); m.userData.col = dispCol(p); meshes.set(id, m) }
      if (m.userData.col !== dispCol(p)) { m.userData.band.color.set(dispCol(p)); m.userData.col = dispCol(p) }
      setPlayerGun(m, cls); setTag(m, name, isEnemy(p) ? (isTeamMode() ? '#ff8a8a' : '#ffffff') : '#8fd0ff', hp, ctex)
    }
  }
  for (const id of [...R.players.keys()]) if (!seen.has(id)) { R.players.delete(id); const m = meshes.get(id); if (m) { scene.remove(m); meshes.delete(id) } }
  for (const e of s.ev) handleEvent(e)
}
const PWT = { 1: ['#8fd8ff', .45], 2: ['#ff8a3a', .6], 3: ['#c9a8ff', .6] };
function handleEvent(e) {
  const dist = (x, y, z) => Math.hypot(x - me.x, y - me.y - EYE, z - me.z);
  switch (e[0]) {
    case 'shot': { const [, id, ci, ox, oy, oz, hits, pw] = e, k = CK[ci]; lastShotAt.set(id, performance.now()); sfxShot(k, id === NET.myId ? 0 : dist(ox, oy, oz), pw === 2);
      if (id === NET.myId) { if (S.pov === 'tp' && meMesh && meMesh.visible) meMesh.userData.muzzle.getWorldPosition(_a); else if (VM[k]) VM[k].userData.flash.getWorldPosition(_a); else _a.set(ox, oy, oz);
        me.kick += k === 'sniper' ? .075 : k === 'shotgun' ? .06 : k === 'dmr' ? .03 : .012; me.recoil = k === 'sniper' || k === 'shotgun' ? 1 : k === 'dmr' ? .6 : .35; flashT = .04; if (S.shake) shake = Math.max(shake, k === 'sniper' ? .35 : k === 'shotgun' ? .28 : .06); if (isTouch && navigator.vibrate) navigator.vibrate(k === 'sniper' || k === 'shotgun' ? 25 : 8) }
      else { const m = meshes.get(id); if (m && m.visible) m.userData.muzzle.getWorldPosition(_a); else _a.set(ox, oy, oz) }
      const tc = PWT[pw]; for (const [x, y, z, ht] of hits) { _b.set(x, y, z); tracer(_a, _b, k === 'sniper' ? .025 : .012, tc ? tc[0] : undefined, tc ? tc[1] : undefined);
        if (ht === 3) { burst(x, y, z, pw === 2 ? '#ff7a2a' : '#8a8070', k === 'shotgun' ? (pw === 2 ? 3 : 1) : 4, 2.2, .3); addDecal(x, y, z, ...hitNormal(x, y, z)) } if (pw === 2 && ht && ht < 3) burst(x, y, z, '#ff8a3a', 5, 2, .5) } break }
    case 'hit': { const [, vid, by, dm, head, x, y, z] = e; burst(x, y + (head ? .45 : 0), z, '#7a1a1a', head ? 10 : 6, 2.5, .4);
      if (by === NET.myId) { hitMarkT = performance.now(); $('hm').classList.toggle('head', !!head); if (head) tone(1900, 1700, .08, .12, 'sine'); else tone(1400, 1250, .05, .08, 'sine'); if (S.dmgn) addDmg(x, y + .5, z, dm, head) }
      if (vid === NET.myId) { hurt = .8; if (S.shake) shake = Math.max(shake, .2); const a = R.players.get(by); if (a) dirHit(a.rx, a.rz); if (isTouch && navigator.vibrate) navigator.vibrate(30) } break }
    case 'kill': { const [, kn, kc, vn, vc, w, kid, vid, st, head, x, y, z, ads] = e; addFeed(kn, kc, vn, vc, w, head, kid === NET.myId || vid === NET.myId); burst(x, y, z, '#5a1414', 20, 3, .8);
      if (kid === NET.myId) { ST.k++; if (head) ST.hs++; ST.best = Math.max(ST.best, st); saveST(); tone(700, 1400, .16, .13, 'square');
        const an = st >= 5 ? ['UNSTOPPABLE', '🔥 ' + st + ' STREAK', '#ff7a5a'] : st === 4 ? ['RAMPAGE', '4 STREAK', '#ff9f5a'] : st === 3 ? ['TRIPLE KILL', '3 STREAK', '#ffd166'] : st === 2 ? ['DOUBLE KILL', '2 STREAK', '#c4f25a'] :
          (w === 'sniper' && !ads) ? ['NO-SCOPE', 'ELIMINATED ' + vn, '#b39dff'] : head ? ['HEADSHOT', 'ELIMINATED ' + vn, '#ff7a7a'] : ['ELIMINATED', vn, '#ffffff']; announce(an[0], an[1], an[2]) }
      if (vid === NET.myId) { ST.d++; saveST(); tone(320, 50, .6, .2, 'sawtooth'); if (S.shake) shake = .4; R.killer = kn; R.killerId = kid; R.killW = w; me.deathT = performance.now(); showDeath() } break }
    case 'pw': { const [, id, ci] = e, k = CK[ci], P = CLS[k].pw; if (id === NET.myId) { announce(P.n, 'GUN POWER ACTIVE · ' + P.dur + 's', CLS[k].col); tone(300, 900, .25, .12, 'triangle'); noise(.3, 1200, .08) } break }
    case 'lvl': if (e[1] === NET.myId) { announce('UPGRADE', 'LEVEL ' + e[3] + '/5 · ' + CLS[e[2]].n.toUpperCase(), '#c4f25a'); tone(500, 1100, .2, .12, 'triangle') } break;
    case 'end': { const [, win, wt, wid] = e, p = myP(); ST.m++; const iWon = p && (wt >= 0 ? p.team === wt : wid === NET.myId); if (iWon) ST.w++; saveST();
      announce(win === 'DRAW' ? 'DRAW' : iWon ? 'VICTORY' : win + ' WINS', 'MATCH OVER · BACK TO LOBBY SOON', iWon ? '#c4f25a' : '#ffd166'); tone(400, 1200, .6, .15, 'triangle'); $('death').classList.add('hidden'); if (document.pointerLockElement) document.exitPointerLock(); break }
  }
}
function showDeath() { if (document.pointerLockElement) document.exitPointerLock(); GS.paused = false; closeModal('pause'); $('death').classList.remove('hidden'); $('kName').textContent = R.killer || '?'; $('kWep').innerHTML = CLS[R.killW] ? `with <b>${CLS[R.killW].n}</b>` : ''; $('rsHint').textContent = isTouch ? '' : `[ Press ${keyLabel(S.keys.jump)} to respawn ]`; setTimeout(() => fillAds($('death')), 200) }
function addFeed(kn, kc, vn, vc, w, head, mine) { const d = document.createElement('div'); d.className = 'fi' + (mine ? ' me' : ''); d.innerHTML = `<span style="color:${kc}">${esc(kn)}</span>${CLS[w] ? gunIcon(w) : ''}${head ? '<span>🎯</span>' : ''}<span style="color:${vc}">${esc(vn)}</span>`; const f = $('feed'); f.prepend(d); while (f.children.length > 5) f.lastChild.remove(); setTimeout(() => d.style.opacity = 0, 5000); setTimeout(() => d.remove(), 5500) }
let gunIcon = () => ''; export function setGunIcon(fn) { gunIcon = fn }
let annT = 0; export function announce(t, sub, c) { const e = $('announce'); e.querySelector('.a1').textContent = t; e.querySelector('.a2').textContent = sub; e.querySelector('.a1').style.color = c; e.classList.remove('show'); void e.offsetWidth; e.classList.add('show'); clearTimeout(annT); annT = setTimeout(() => e.classList.remove('show'), 1800) }
const dmgs = []; function addDmg(x, y, z, v, h) { const el = document.createElement('div'); el.className = 'dn' + (h ? ' h' : ''); el.textContent = v; $('dnLayer').appendChild(el); dmgs.push({ el, p: new THREE.Vector3(x + rnd(-.3, .3), y, z + rnd(-.3, .3)), life: .8 }); if (dmgs.length > 14) { const o = dmgs.shift(); o.el.remove() } }
function updDmg(dt) { for (let i = dmgs.length - 1; i >= 0; i--) { const d = dmgs[i]; d.life -= dt; d.p.y += dt * .8; if (d.life <= 0) { d.el.remove(); dmgs.splice(i, 1); continue } _v.copy(d.p).project(camera); if (_v.z > 1) { d.el.style.display = 'none'; continue } d.el.style.display = ''; d.el.style.left = (_v.x * .5 + .5) * innerWidth + 'px'; d.el.style.top = (-_v.y * .5 + .5) * innerHeight + 'px'; d.el.style.opacity = Math.min(1, d.life * 2.5) } }
function dirHit(ax, az) { const a = Math.atan2(-(ax - me.x), -(az - me.z)) - me.yaw; const el = document.createElement('div'); el.className = 'dd'; el.style.transform = `rotate(${-a}rad)`; $('dirs').appendChild(el); setTimeout(() => el.style.opacity = 0, 500); setTimeout(() => el.remove(), 1400) }

// ---------------- local actions (called by input.js) ----------------
export function togglePov() { S.pov = S.pov === 'tp' ? 'fp' : 'tp'; applySettings(); toast(S.pov === 'tp' ? '3rd person view' : '1st person view') }
export function crouchPress() { if (me.sprint && me.ground && me.slideCd <= 0) IN.slideReq = true; else if (me.slideT > 0) me.slideT = 0; else me.crouch = !me.crouch }
export function reqRespawn() { const p = myP(); if (!p || p.alive || p.resIn > 0 || R.phase !== 'play') return; IN.rsReq = true; closeModal('classModal'); closeModal('settingsModal'); if (!isTouch) cv.requestPointerLock() }
export const chatting = () => document.activeElement && document.activeElement.id === 'chatIn';
export function wantShoot() { const p = myP(); if (!p || !p.alive || R.phase !== 'play' || GS.paused) return false; const man = isTouch ? IN.touch.fireHeld : (IN.locked && act('fire')); return man || (R.fire === 'auto' && autoTarget) }
export function localInput() {
  const i = { t: 'i', x: r2(me.x), y: r2(me.y), z: r2(me.z), yw: +me.aimYaw.toFixed(3), pt: +me.aimPitch.toFixed(3), ln: r2(me.lean), sh: wantShoot() ? 1 : 0, rl: IN.rlReq ? 1 : 0, sp: me.sp, ad: me.ads ? 1 : 0, cr: (me.crouch || me.slideT > 0) ? 1 : 0, cls: S.cls, rs: IN.rsReq ? 1 : 0, ar: S.autoRl ? 1 : 0, pw: IN.pwReq ? 1 : 0 };
  IN.rlReq = IN.rsReq = IN.pwReq = false; return i
}

// ---------------- local movement ----------------
function aimAssist(dt, now) {
  autoTarget = false; const p = myP(); if (!p || !p.alive || GS.paused) return; const Wp = CLS[p.cls];
  const ey = me.y + me.eye, o = [me.x, ey, me.z], fwd = dirOf(me.aimYaw, me.aimPitch), tw = rayWorld(o, fwd, Wp.maxR, true);
  for (const q of R.players.values()) { if (!q.alive || q.id === NET.myId) continue; for (const [cx, cy, cz, r] of hitSpheres(q.rx, q.ry, q.rz, q.ryaw, q.cr, q.rln)) { const t = raySphere(o, fwd, cx, cy, cz, r * 1.15); if (t > 0 && t < tw) { aimedId = q.id; aimedT = now; if (isEnemy(q)) autoTarget = true } } }
  if (R.aim === 'manual') return;
  const cone = R.aim === 'auto' ? (me.ads ? .5 : .75) : (me.ads ? .16 : .09); let best = null, ba = 1e9, by = 0, bp = 0;
  for (const q of R.players.values()) { if (!q.alive || !isEnemy(q) || q.sh) continue; if (concealed(q.rx, q.rz, me.x, me.z, lastShotAt.get(q.id), now)) continue;
    const ty = q.ry + (R.aim === 'auto' && Wp.scope ? (q.cr ? 1.16 : 1.62) : (q.cr ? .85 : 1.25)), dx = q.rx - me.x, dz = q.rz - me.z, hd = Math.hypot(dx, dz); if (hd > Wp.maxR) continue;
    const yaw = Math.atan2(-dx, -dz), pit = Math.atan2(ty - ey, hd), da = angDiff(yaw, me.aimYaw), dp = pit - me.aimPitch, ang = Math.hypot(da, dp);
    if (ang > cone || ang > ba) continue; if (!losPts(me.x, ey, me.z, q.rx, ty, q.rz)) continue; ba = ang; best = q; by = da; bp = dp }
  if (!best) return;
  const firing = wantShoot() || me.ads || (isTouch && (IN.touch.look || IN.touch.fireHeld));
  const k = R.aim === 'auto' ? Math.min(1, dt * 12) : (firing ? Math.min(1, dt * 4) : Math.min(1, dt * 1.2));
  me.yaw += by * k; me.pitch = clamp(me.pitch + bp * k, -1.5, 1.5)
}
function updateLocal(dt, now) {
  const p = myP(), alive = p && p.alive && R.phase === 'play'; aimAssist(dt, now); me.slideCd = Math.max(0, me.slideCd - dt);
  if (!alive) { IN.jumpReq = false; IN.slideReq = false; me.vx = me.vz = 0; me.slideT = 0; me.lean = 0; return }
  let ix = 0, iz = 0; const free = !GS.paused && !chatting();
  if (free) { if (act('fwd')) iz -= 1; if (act('back')) iz += 1; if (act('left')) ix -= 1; if (act('right')) ix += 1 }
  if (IN.touch.joy) { const v = IN.joyVec(); ix = v.x; iz = v.y }
  const il = Math.hypot(ix, iz); if (il > 1) { ix /= il; iz /= il }
  const Wp = CLS[p.cls], adren = p.pwK === 'smg' && p.pwA > 0;
  const sprintKey = S.sprintToggle ? me.sprintT : (act('sprint') || me.sprintT);
  if (iz >= -.2 && me.sprintT && !IN.touch.joy) me.sprintT = false;
  me.sprint = !!((sprintKey || (IN.touch.joy && IN.joyVec().m > .95)) && iz < -.2 && !me.ads && !(isTouch ? IN.touch.fireHeld : act('fire')) && me.slideT <= 0 && Math.abs(me.lean) < .2); if (me.sprint) me.crouch = false;
  // lean / peek
  let lt = 0; if (free && !me.sprint && me.slideT <= 0) lt = (act('leanR') || IN.touch.leanR ? 1 : 0) - (act('leanL') || IN.touch.leanL ? 1 : 0);
  if (lt) { const rx0 = Math.cos(me.yaw) * lt, rz0 = -Math.sin(me.yaw) * lt, room = rayWorld([me.x, me.y + me.eye, me.z], [rx0, 0, rz0], 1, false); lt *= clamp((room - .15) / (LEAN + .05), 0, 1) }
  me.lean += (lt - me.lean) * Math.min(1, dt * 10);
  const fx = -Math.sin(me.yaw), fz = -Math.cos(me.yaw), rx = Math.cos(me.yaw), rz = -Math.sin(me.yaw), wx = fx * -iz + rx * ix, wz = fz * -iz + rz * ix;
  const sp = SPEED * Wp.spd * (me.ads ? .55 : 1) * (me.crouch ? .5 : 1) * (me.sprint ? 1.5 : 1) * (adren ? 1.35 : 1) * (1 - Math.abs(me.lean) * .45);
  if (IN.slideReq && me.ground && me.sprint) { const hv = Math.hypot(me.vx, me.vz) || 1, ss = SPEED * Wp.spd * 2.3 * (adren ? 1.2 : 1); me.vx = me.vx / hv * ss; me.vz = me.vz / hv * ss; me.slideT = .85; me.slideCd = 1; me.sprint = false; noise(.55, 420, .16); if (S.shake) shake = Math.max(shake, .08) }
  IN.slideReq = false;
  if (me.slideT > 0) { me.slideT -= dt; const f = Math.exp(-dt * 1.35); me.vx *= f; me.vz *= f; me.vx += rx * ix * dt * 4; me.vz += rz * ix * dt * 4; if (me.slideT <= 0 || Math.hypot(me.vx, me.vz) < 2.6) { me.slideT = 0; me.crouch = act('crouch') } }
  else { const acc = me.ground ? 16 : 3; me.vx += (wx * sp - me.vx) * Math.min(1, dt * acc); me.vz += (wz * sp - me.vz) * Math.min(1, dt * acc) }
  if (IN.jumpReq && me.ground) { me.vy = JUMP; me.ground = false; me.crouch = false; me.slideT = 0 } IN.jumpReq = false;
  moveCircle(me, me.vx * dt, me.vz * dt);
  me.vy -= GRAV * dt; me.y += me.vy * dt; const f = floorAt(me.x, me.z, me.y); if (me.y <= f) { if (!me.ground && me.vy < -7) tone(120, 60, .08, .08, 'sine'); me.y = f; me.vy = 0; me.ground = true } else if (me.y > f + .05) me.ground = false;
  const c = ceilAt(me.x, me.z, me.y); if (me.y + HEAD > c) { me.y = Math.max(f, c - HEAD); if (me.vy > 0) me.vy = 0 }
  me.eye += ((me.slideT > 0 ? SEYE : me.crouch ? CEYE : EYE) - me.eye) * Math.min(1, dt * 12);
  me.roll += ((me.slideT > 0 ? .07 : 0) - me.lean * .14 - me.roll) * Math.min(1, dt * 10);
  const hs = Math.hypot(me.vx, me.vz); if (me.ground && hs > 1 && me.slideT <= 0) me.bob += dt * hs * (me.sprint ? 1.9 : 1.5)
}

// ---------------- render ----------------
const clock = new THREE.Clock(); let menuT = 0, fpsAcc = 0, fpsN = 0;
export const resetMenuCam = () => { menuT = 0 };
function poseMesh(m, x, y, z, yaw, pitch, cr, mv, lean) { const U = m.userData; m.position.set(x, y, z); m.rotation.y = yaw; U.head.rotation.x = pitch * .6; U.arms.rotation.x = pitch; U.body.position.y = cr ? -.45 : 0; U.torso.rotation.z = -(lean || 0) * .32;
  U.walk += mv; U.legs[0].rotation.x = Math.sin(U.walk) * .6 * Math.min(1, mv * 25); U.legs[1].rotation.x = -U.legs[0].rotation.x }
function render(dt, now) {
  const t = clock.elapsedTime; updFx(dt, t); updParticles(dt); updTracers(dt);
  if (!GS.inGame) { menuT += dt * .05; const m = MAPS[W.MAPID];
    if (m.indoor) { const x = Math.sin(menuT * 1.5) * W.BX * .55; camera.position.set(x, m.camH, -W.BZ * .3); camera.lookAt(x + (Math.cos(menuT * 1.5) > 0 ? 8 : -8), 1.6, 0) }
    else { const r = W.SZ * .75; camera.position.set(Math.sin(menuT) * r, 6 + Math.sin(menuT * 1.7) * 1.5, Math.cos(menuT) * r); camera.lookAt(0, 2.5, 0) }
    camera.fov = 60; camera.updateProjectionMatrix(); vmRoot.visible = false; if (meMesh) meMesh.visible = false; renderer.render(scene, camera); return }
  const p = myP();
  for (const [id, m] of meshes) { const q = R.players.get(id); if (!q) { m.visible = false; continue } m.visible = q.alive; if (!q.alive) continue;
    const k = Math.min(1, dt * 14); q.rx += (q.x - q.rx) * k; q.ry += (q.y - q.ry) * k; q.rz += (q.z - q.rz) * k; q.ryaw += angDiff(q.yaw, q.ryaw) * k; q.rln += (q.lean - q.rln) * k;
    poseMesh(m, q.rx, q.ry, q.rz, q.ryaw, q.pitch, q.cr, Math.hypot(q.x - q.rx, q.z - q.rz) * 5, q.rln); m.userData.shield.visible = q.sh;
    const au = m.userData.aura; au.visible = q.pwA > 0; if (au.visible) au.material.color.set(CLS[q.pwK] ? CLS[q.pwK].col : '#fff');
    // name tags: teammates always; enemies only while you aim at them and they aren't hidden in cover
    const en = isEnemy(q); m.userData.tag.visible = !en || (aimedId === id && now - aimedT < 1200 && !concealed(q.rx, q.rz, me.x, me.z, lastShotAt.get(id), now)) }
  const alive = p && p.alive; shake *= Math.pow(.004, dt); me.kick *= Math.pow(.0006, dt); me.recoil *= Math.pow(.002, dt);
  const Wp = p ? CLS[p.cls] : CLS.ar, scopedADS = alive && Wp.scope && me.ads, tp = alive && S.pov === 'tp' && !scopedADS, sh = S.shake ? shake : 0;
  let swx = 0, swy = 0;
  if (scopedADS) { me.swayT += dt; const deadeye = p.pwK === 'sniper' && p.pwA > 0, hold = act('sprint') && me.breath > 0; if (hold) me.breath = Math.max(0, me.breath - dt / 4); else me.breath = Math.min(1, me.breath + dt / 3.5);
    const amp = deadeye ? 0 : (hold ? .12 : 1) * (me.crouch ? .55 : 1) * .0042 * (isTouch ? .4 : 1); swx = Math.sin(me.swayT * .9) * amp + Math.sin(me.swayT * 2.3) * amp * .35; swy = Math.sin(me.swayT * 1.3) * amp * .8 }
  else me.breath = Math.min(1, me.breath + dt / 3.5);
  if (alive) {
    const L = me.lean * LEAN, rx = Math.cos(me.yaw), rz = -Math.sin(me.yaw), ex = me.x + rx * L, ez = me.z + rz * L, ey = me.y + me.eye - Math.abs(L) * .08;
    if (tp) { const D = dirOf(me.yaw, me.pitch), dist = me.ads ? 1.7 : 3.1, side = me.ads ? .5 : .6, tx = -D[0] * dist + rx * side, ty = -D[1] * dist + .35, tz = -D[2] * dist + rz * side, len = Math.hypot(tx, ty, tz);
      const hit = rayWorld([ex, ey, ez], [tx / len, ty / len, tz / len], len), f = Math.max(.3, Math.min(len, hit - .25)) / len;
      camera.position.set(ex + tx * f, ey + ty * f, ez + tz * f); camera.rotation.set(me.pitch + me.kick * .6, me.yaw, me.roll * .5, 'YXZ');
      const C = [camera.position.x, camera.position.y, camera.position.z], tc = Math.max(dist + 2, rayWorld(C, D, 250)); const Tx = C[0] + D[0] * tc - ex, Ty = C[1] + D[1] * tc - ey, Tz = C[2] + D[2] * tc - ez; me.aimYaw = Math.atan2(-Tx, -Tz); me.aimPitch = Math.atan2(Ty, Math.hypot(Tx, Tz)) }
    else { const bob = S.bob && !scopedADS ? Math.sin(me.bob * 2) * .035 : 0; camera.position.set(ex, ey + bob, ez); me.aimYaw = me.yaw + swx; me.aimPitch = me.pitch + swy; camera.rotation.set(me.aimPitch + me.kick + (Math.random() - .5) * sh * .03, me.aimYaw + (Math.random() - .5) * sh * .03, me.roll, 'YXZ') }
  } else { const k = R.players.get(R.killerId), since = (now - me.deathT) / 1000;
    if (k && k.alive && k.id !== NET.myId && since > .9) { const yw = k.ryaw; _a.set(k.rx + Math.sin(yw) * 3.3 + Math.cos(yw) * .8, k.ry + 2.3, k.rz + Math.cos(yw) * 3.3 - Math.sin(yw) * .8); camera.position.lerp(_a, Math.min(1, dt * 6)); _b.set(k.rx - Math.sin(yw) * 8, k.ry + 1.3, k.rz - Math.cos(yw) * 8); camera.lookAt(_b) }
    else { camera.position.y += (me.y + 4 - camera.position.y) * Math.min(1, dt * 1.5); camera.rotation.x += (-.9 - camera.rotation.x) * Math.min(1, dt * 2) } }
  if (meMesh) { meMesh.visible = tp; if (tp) { setPlayerGun(meMesh, p.cls); meMesh.userData.shield.visible = p.sh; meMesh.userData.aura.visible = p.pwA > 0; if (p.pwA > 0) meMesh.userData.aura.material.color.set(CLS[p.pwK].col); poseMesh(meMesh, me.x, me.y, me.z, me.yaw, me.aimPitch, me.crouch || me.slideT > 0, Math.hypot(me.vx, me.vz) * dt * 1.2, me.lean) } }
  const zoom = scopedADS ? (Wp.zooms ? Wp.zooms[me.zl] : Wp.zoom) : Wp.zoom;
  const tf = me.ads && alive ? S.fov / (tp ? Math.min(zoom, 1.4) : zoom) : (me.sprint ? S.fov + 6 : me.slideT > 0 ? S.fov + 9 : S.fov); camera.fov += (tf - camera.fov) * Math.min(1, dt * 14); camera.updateProjectionMatrix();
  const scoped = scopedADS && camera.fov < S.fov / zoom * 1.3; vmRoot.visible = alive && !scoped && !tp; $('scope').classList.toggle('hidden', !scoped);
  if (scoped) { $('zoomV').textContent = zoom.toFixed(1) + '×'; $('breath').firstChild.style.width = (me.breath * 100) + '%'; $('scopeTxt').textContent = isTouch ? 'TAP ◎ AGAIN TO ZOOM' : (Wp.zooms ? keyLabel(S.keys.zoom) + '/WHEEL ZOOM · ' : '') + 'HOLD ' + keyLabel(S.keys.sprint) + ' TO STEADY' }
  $('scopeHint').classList.toggle('hidden', !(alive && Wp.scope && !me.ads && now < (me.hintUntil || 0))); $('scopeHint').textContent = isTouch ? 'TAP ◎ TO SCOPE' : keyLabel(S.keys.aim) + ' TO SCOPE';
  if (p && curVM !== p.cls) { if (VM[curVM]) VM[curVM].visible = false; curVM = p.cls; VM[curVM].visible = true; vmRoot.position.y = -.5 }
  if (alive && !tp) { const ads = me.ads, hs = Math.hypot(me.vx, me.vz) / SPEED, b = S.bob ? 1 : 0, sy = VM[curVM].userData.sightY;
    const tx = ads ? 0 : .17, ty = (ads ? -sy : -.19) + (b ? Math.abs(Math.sin(me.bob)) * .012 * hs * (ads ? .2 : 1) : 0) - (p.rl > 0 ? .08 : 0) - (me.sprint ? .04 : 0), tz = (ads ? -.17 : -.3) + me.recoil * .05;
    vmRoot.position.x += (tx + (b ? Math.cos(me.bob) * .012 * hs * (ads ? .2 : 1) : 0) - vmRoot.position.x) * Math.min(1, dt * 16); vmRoot.position.y += (ty - vmRoot.position.y) * Math.min(1, dt * 12); vmRoot.position.z += (tz - vmRoot.position.z) * Math.min(1, dt * 20);
    vmRoot.rotation.set(me.recoil * .1 + (p.rl > 0 ? -.5 : 0) + (me.sprint ? -.3 : 0) + (me.slideT > 0 ? .1 : 0), me.sprint ? .55 : 0, (me.sprint ? .25 : 0) + (me.slideT > 0 ? -.25 : 0)) }
  flashT -= dt; if (VM[curVM]) { const fl = VM[curVM].userData.flash; fl.visible = flashT > 0 && !tp; if (fl.visible) { fl.scale.setScalar(rnd(.08, .13)); fl.material.rotation = Math.random() * 6 } } flashLight.intensity = flashT > 0 && MED && !tp ? 2.5 : 0;
  renderer.render(scene, camera);
  const pt = $('pwTint'); if (alive && p.pwA > 0) { pt.style.opacity = 1; pt.style.background = `radial-gradient(circle,transparent 60%,${CLS[p.pwK].col}2e)` } else pt.style.opacity = 0;
  const spread = (me.ads ? Wp.adsSpr : Wp.spr) * (me.crouch ? .75 : 1) * 420 + 5 + me.recoil * 10 + (me.ground ? 0 : 10) + Math.hypot(me.vx, me.vz) * .8;
  $('xh').style.display = alive && !scoped && !(me.ads && !tp && !Wp.scope && Wp.pel === 1 && S.xh !== 'dot') ? '' : 'none';
  for (const [id, tr] of [['x1', `translateY(${-spread - 9}px)`], ['x2', `translateY(${spread}px)`], ['x3', `translateX(${-spread - 9}px)`], ['x4', `translateX(${spread}px)`]]) { const e = $(id); if (e) e.style.transform = tr }
  const xr = $('xr'); if (xr) { const s2 = 28 + spread; xr.style.width = xr.style.height = s2 + 'px'; xr.style.left = xr.style.top = -s2 / 2 + 'px' }
  $('xh').style.setProperty('--xc', autoTarget ? '#ff6b6b' : S.xhc); $('hm').style.opacity = now - hitMarkT < 160 ? 1 : 0;
  hurt = Math.max(0, hurt - dt * 1.8); const low = alive && p.hp < 35 ? .3 + Math.sin(now / 300) * .08 : 0; $('hurt').style.opacity = Math.max(hurt * .8, low);
  $('lockHint').classList.toggle('hidden', isTouch || IN.locked || !alive || GS.paused || R.phase !== 'play' || chatting());
  $('hideChip').classList.toggle('hidden', !(alive && inHide(me.x, me.z)));
  updDmg(dt)
}

// ---------------- HUD ----------------
let hudT = 0, lastCls = '';
function updateHud(now) {
  if (now - hudT < 100) return; hudT = now; const p = myP(), mode = MODES[R.mode];
  const m = Math.floor(R.tm / 60), s = R.tm % 60; $('timer').textContent = R.phase === 'play' ? `${m}:${String(s).padStart(2, '0')}` : 'LOBBY IN ' + R.tm + 's';
  $('tsA').textContent = R.ts[0]; $('tsB').textContent = R.ts[1];
  const sorted = [...R.players.values()].sort((a, b) => b.k - a.k || a.d - b.d);
  $('lbBox').innerHTML = `<div style="opacity:.5;font-size:10px;letter-spacing:2px;margin-bottom:4px">${R.mode === 'gun' ? 'GUN GAME · 5 LEVELS' : 'FIRST TO ' + mode.goal}</div>` + sorted.slice(0, 5).map((q, i) => `<div class="lr${q.id === NET.myId ? ' me' : ''}"><span>${i + 1}. <span style="color:${dispCol(q)}">●</span> ${esc(q.name)}</span><span>${R.mode === 'gun' ? 'LV' + Math.min(5, Math.floor(q.k / 2) + 1) : q.k}</span></div>`).join('');
  if (p) {
    const Wp = CLS[p.cls]; if (lastCls !== p.cls) { lastCls = p.cls; $('wIcon').innerHTML = gunIcon(p.cls, null, true) } $('wName').textContent = Wp.full; $('wName').style.color = Wp.col;
    $('ammo').innerHTML = p.rl > 0 ? '<small>RELOADING</small>' : (p.pwK === 'ar' && p.pwA > 0 ? '∞' : p.ammo) + `<small> / ${Wp.mag}</small>`;
    $('hpBar').style.width = p.hp + '%'; $('hpBar').style.background = p.hp > 60 ? '#9fd356' : p.hp > 30 ? '#e8c14a' : '#e05a5a'; $('hpNum').textContent = Math.ceil(p.hp);
    $('stance').textContent = me.slideT > 0 ? 'SLIDE' : Math.abs(me.lean) > .3 ? 'PEEK' : me.sprint ? 'SPRINT' : me.crouch ? 'CROUCH' : '';
    const P = Wp.pw, actv = p.pwA > 0, box = $('pwBox'), arc = $('pwArc'); $('pwIc').textContent = actv ? CLS[p.pwK].pw.ic : P.ic; $('pwName').textContent = actv ? CLS[p.pwK].pw.n : P.n;
    if (actv) { box.className = 'glass active'; arc.style.stroke = '#c4f25a'; arc.style.strokeDashoffset = 138.2 * (1 - p.pwA / CLS[p.pwK].pw.dur); $('pwSt').textContent = 'ACTIVE · ' + p.pwA.toFixed(1) + 's' }
    else if (p.pwC > 0) { box.className = 'glass'; arc.style.stroke = 'rgba(255,255,255,.5)'; arc.style.strokeDashoffset = 138.2 * Math.min(1, p.pwC / P.cd); $('pwSt').textContent = 'CHARGING · ' + Math.ceil(p.pwC) + 's' }
    else { box.className = 'glass ready'; arc.style.stroke = '#ffb23f'; arc.style.strokeDashoffset = 0; $('pwSt').textContent = isTouch ? 'READY · TAP PWR' : 'READY · ' + keyLabel(S.keys.power) }
    $('mPw').style.opacity = p.pwC > 0 && !actv ? .45 : 1;
    if (!p.alive && R.phase === 'play') { const k = R.players.get(R.killerId); $('kHp').firstChild.style.width = (k ? k.hp : 0) + '%'; $('specL').innerHTML = k && k.alive && k.id !== NET.myId ? `Spectating: <b>${esc(k.name)}</b>` : '';
      const b = $('respawnBtn'); b.disabled = p.resIn > 0; b.textContent = p.resIn > 0 ? 'RESPAWN IN ' + p.resIn : 'RESPAWN'; if ($('death').classList.contains('hidden')) showDeath() }
    else if (!$('death').classList.contains('hidden') && (p.alive || R.phase !== 'play')) $('death').classList.add('hidden')
  }
  const bd = $('board');
  if (IN.showBoard || R.phase === 'end') { bd.classList.remove('hidden'); const row = (q, i) => `<tr style="${q.id === NET.myId ? 'color:#ffb23f' : ''}"><td>${i + 1}</td><td><span style="color:${dispCol(q)}">●</span> ${esc(q.name)}</td><td>${q.k}</td><td>${q.d}</td><td>${(q.k / Math.max(1, q.d)).toFixed(2)}</td></tr>`;
    const rows = mode.teams ? [0, 1].map(t => `<tr><td colspan="5" style="color:${TEAMC[t]};font-family:Unbounded;font-size:12px;padding-top:10px">TEAM ${TEAMN[t]} — ${R.ts[t]}</td></tr>` + sorted.filter(q => q.team === t).map(row).join('')).join('') : sorted.map(row).join('');
    bd.innerHTML = `<h2>${R.phase === 'end' ? '🏆 ' + esc(R.win) + (R.win === 'DRAW' ? '' : ' WINS') : 'SCOREBOARD'}</h2><table><tr><th>#</th><th>PLAYER</th><th>K</th><th>D</th><th>K/D</th></tr>${rows}</table>${R.phase === 'end' ? `<p style="text-align:center;margin-top:12px;opacity:.7">Returning to lobby in ${R.tm}s</p>` : ''}` }
  else bd.classList.add('hidden')
}

// ---------------- loop ----------------
export function startLoop() {
  function frame() { const dt = Math.min(.05, clock.getDelta()), now = performance.now();
    if (GS.inGame) updateLocal(dt, now); render(dt, now); if (GS.inGame) updateHud(now);
    if (S.fps) { fpsAcc += dt; fpsN++; if (fpsAcc > .5) { $('fps').textContent = Math.round(fpsN / fpsAcc) + ' FPS · ' + Q.toUpperCase(); fpsAcc = 0; fpsN = 0 } }
    requestAnimationFrame(frame) }
  requestAnimationFrame(frame)
}
