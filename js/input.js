// =====================================================================
//  Input: rebindable keyboard/mouse + touch controls
// =====================================================================
import { S, saveS, CLS } from './config.js';
import { $, clamp, isTouch } from './util.js';
import { GS, me, R } from './state.js';
import { ac } from './audio.js';
import { cv, camera } from './render/renderer.js';
import { togglePov, crouchPress, reqRespawn, chatting, myP } from './game/client.js';
import { sendChat } from './game/net.js';
import { renderSettings, closeModal } from './ui/menu.js';
import { tone } from './audio.js';

export const held = new Set();
export const IN = { locked: false, rlReq: false, jumpReq: false, rsReq: false, slideReq: false, pwReq: false, showBoard: false, binding: null,
  touch: { joy: null, look: null, fire: null, fireHeld: false, leanL: false, leanR: false }, joyVec };
export const act = a => { const c = S.keys[a]; return !!c && held.has(c) };
let codeMap = {}; export function rebuildKeyMap() { codeMap = {}; for (const [a, c] of Object.entries(S.keys)) codeMap[c] = a }
rebuildKeyMap();

// ---- key binding capture (used by settings) ----
export function startBinding(action, label) { IN.binding = action; $('bindFor').textContent = label; $('bindCap').classList.remove('hidden') }
function finishBinding(code) {
  const a = IN.binding; IN.binding = null; $('bindCap').classList.add('hidden'); if (!code) return;
  const prev = S.keys[a]; for (const [k, c] of Object.entries(S.keys)) if (c === code && k !== a) S.keys[k] = prev; // swap on conflict
  S.keys[a] = code; saveS(); rebuildKeyMap(); renderSettings('keys')
}

function press(a) {
  if (!GS.inGame) return; const p = myP();
  switch (a) {
    case 'jump': if (p && !p.alive) reqRespawn(); else IN.jumpReq = true; break;
    case 'crouch': crouchPress(); break;
    case 'reload': IN.rlReq = true; break;
    case 'power': IN.pwReq = true; break;
    case 'pov': togglePov(); break;
    case 'scores': IN.showBoard = true; break;
    case 'aim': if (!IN.locked && !isTouch) return; me.ads = S.adsToggle ? !me.ads : true; if (me.ads) { me.sprintT = false; me.slideT = 0 } break;
    case 'sprint': if (S.sprintToggle && !me.ads) me.sprintT = !me.sprintT; break;
    case 'zoom': if (p && CLS[p.cls].zooms && me.ads) { me.zl = me.zl ? 0 : 1; tone(900, 1200, .04, .05, 'sine') } break;
    case 'chat': openChat(); break
  }
}
function release(a) { if (a === 'scores') IN.showBoard = false; if (a === 'aim' && !S.adsToggle) me.ads = false }
function openChat() { const ci = $('chatIn'); ci.classList.remove('hidden'); held.clear(); setTimeout(() => ci.focus(), 0) }

export function initInput() {
  addEventListener('keydown', e => {
    if (IN.binding) { e.preventDefault(); finishBinding(e.code === 'Escape' ? null : e.code); return }
    const ae = document.activeElement;
    if (ae && ae.id === 'chatIn') { if (e.key === 'Enter') { sendChat(ae.value); ae.value = ''; ae.blur(); ae.classList.add('hidden') } else if (e.key === 'Escape') { ae.blur(); ae.classList.add('hidden') } e.stopPropagation(); return }
    if (ae && ae.tagName === 'INPUT') return;
    if (!GS.inGame) return;
    const a = codeMap[e.code]; if (a || e.code === 'Tab' || e.code === 'Space') e.preventDefault();
    if (held.has(e.code)) return; held.add(e.code); if (a) press(a)
  });
  addEventListener('keyup', e => { held.delete(e.code); const a = codeMap[e.code]; if (a) release(a) });
  document.addEventListener('pointerlockchange', () => {
    IN.locked = document.pointerLockElement === cv;
    if (!IN.locked) { for (const c of [...held]) if (c.startsWith('Mouse')) held.delete(c); if (!S.adsToggle) me.ads = false;
      const p = myP(); if (GS.inGame && !isTouch && p && p.alive && !chatting() && !document.querySelector('.modal:not(.hidden)')) { GS.paused = true; $('pause').classList.remove('hidden') } }
    else { GS.paused = false; closeModal('pause') }
  });
  document.addEventListener('mousemove', e => { if (!IN.locked) return; const k = .0022 * S.sens * (camera.fov / S.fov) * (me.ads ? S.adsSens : 1); me.yaw -= e.movementX * k; me.pitch = clamp(me.pitch - e.movementY * k * (S.invY ? -1 : 1), -1.5, 1.5) });
  addEventListener('mousedown', e => {
    if (IN.binding) { e.preventDefault(); finishBinding('Mouse' + e.button); return }
    ac(); if (!GS.inGame || isTouch || e.target !== cv) return; const p = myP();
    if (!IN.locked) { if (p && p.alive) cv.requestPointerLock(); return }
    const code = 'Mouse' + e.button; held.add(code); const a = codeMap[code]; if (a) press(a)
  });
  addEventListener('mouseup', e => { const code = 'Mouse' + e.button; held.delete(code); const a = codeMap[code]; if (a) release(a) });
  addEventListener('wheel', e => { if (!GS.inGame) return; const p = myP(); if (p && CLS[p.cls].zooms && me.ads) { me.zl = e.deltaY < 0 ? 1 : 0 } }, { passive: true });
  addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('blur', () => held.clear());
  if (isTouch) initTouch()
}

// ---------------- touch ----------------
function tbtn(id, down, up) { const el = $(id);
  el.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); ac(); el.classList.add('on'); down(e.changedTouches[0]) }, { passive: false });
  el.addEventListener('touchend', e => { e.preventDefault(); el.classList.remove('on'); up && up(e.changedTouches[0]) }, { passive: false });
  el.addEventListener('touchcancel', () => { el.classList.remove('on'); up && up() }) }
function joyVec() { const j = IN.touch.joy; if (!j) return { x: 0, y: 0, m: 0 }; const R2 = 55 * S.touchScale; let dx = (j.x - j.ox) / R2, dy = (j.y - j.oy) / R2; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l } return { x: dx, y: dy, m: Math.min(1, l) } }
const mirror = x => document.body.classList.contains('lefty') ? innerWidth - x : x;
export function resetTouch() { const T = IN.touch; T.joy = T.look = T.fire = null; T.fireHeld = T.leanL = T.leanR = false; const j = $('joy'); j.classList.remove('on'); j.style.left = j.style.top = ''; $('knob').style.transform = '' }
function initTouch() {
  const T = IN.touch;
  const fireDown = t => { T.fireHeld = true; T.fire = { id: t.identifier, x: t.clientX, y: t.clientY } }, fireUp = () => { T.fireHeld = false; T.fire = null };
  tbtn('mFire', fireDown, fireUp); tbtn('mFire2', fireDown, fireUp);
  tbtn('mAds', () => { const p = myP(); if (me.ads && p && CLS[p.cls].zooms && me.zl === 0) { me.zl = 1; return } me.ads = !me.ads; me.zl = 0; if (me.ads) me.sprintT = false });
  tbtn('mJump', () => { const p = myP(); if (p && !p.alive) reqRespawn(); else IN.jumpReq = true }); tbtn('mRl', () => { IN.rlReq = true }); tbtn('mPov', () => togglePov());
  tbtn('mCr', () => crouchPress()); tbtn('mPw', () => { IN.pwReq = true }); tbtn('mSpr', () => { me.sprintT = !me.sprintT; $('mSpr').classList.toggle('act', me.sprintT) });
  tbtn('mLeanL', () => { T.leanL = true }, () => { T.leanL = false }); tbtn('mLeanR', () => { T.leanR = true }, () => { T.leanR = false });
  cv.addEventListener('touchstart', e => { e.preventDefault(); ac(); for (const t of e.changedTouches) { const mx = mirror(t.clientX);
    if (mx < innerWidth * .42 && t.clientY > innerHeight * .3 && !T.joy) { T.joy = { id: t.identifier, ox: t.clientX, oy: t.clientY, x: t.clientX, y: t.clientY }; const j = $('joy'); j.classList.add('on'); j.style.left = mx + 'px'; j.style.top = t.clientY + 'px' }
    else if (!T.look) T.look = { id: t.identifier, x: t.clientX, y: t.clientY } } }, { passive: false });
  addEventListener('touchmove', e => { for (const t of e.changedTouches) {
    if (T.joy && t.identifier === T.joy.id) { T.joy.x = t.clientX; T.joy.y = t.clientY; const v = joyVec(); $('knob').style.transform = `translate(${v.x * 45 * S.touchScale * (document.body.classList.contains('lefty') ? -1 : 1)}px,${v.y * 45 * S.touchScale}px)` }
    for (const s of [T.look, T.fire]) if (s && t.identifier === s.id) { const k = .0052 * S.sens * (camera.fov / S.fov) * (me.ads ? S.adsSens : 1); me.yaw -= (t.clientX - s.x) * k; me.pitch = clamp(me.pitch - (t.clientY - s.y) * k * (S.invY ? -1 : 1), -1.5, 1.5); s.x = t.clientX; s.y = t.clientY } } }, { passive: false });
  const tEnd = e => { for (const t of e.changedTouches) { if (T.joy && t.identifier === T.joy.id) { T.joy = null; const j = $('joy'); j.classList.remove('on'); j.style.left = j.style.top = ''; $('knob').style.transform = '' } if (T.look && t.identifier === T.look.id) T.look = null } };
  addEventListener('touchend', tEnd); addEventListener('touchcancel', tEnd)
}
