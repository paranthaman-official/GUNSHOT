// =====================================================================
//  UI: home page, loadout, settings (incl. key bindings), lobby, chat, toasts
// =====================================================================
import { S, saveS, ST, CLS, CK, MODES, MK2, MAPS, MK, PALETTE, TEAMC, TEAMN, ACTIONS, DEFAULT_KEYS, GAME } from '../config.js';
import { $, esc, isTouch, keyLabel } from '../util.js';
import { NET, GS, R } from '../state.js';
import { ac, setVolume } from '../audio.js';
import { cv } from '../render/renderer.js';
import { buildWorld, applyExposure } from '../render/world.js';
import { W } from '../world/layout.js';
import { startHost, joinRoom, sendCls, sendChat, sendToHost } from '../game/net.js';
import { hostSetCfg, hostSwitch, hostStart } from '../game/host.js';
import { resetMenuCam, reqRespawn, setGunIcon, togglePov } from '../game/client.js';
import { startBinding, rebuildKeyMap } from '../input.js';
import { fillAds } from './ads.js';

// ---------- small widgets ----------
export function seg(el, opts, cur, on, ro) { el.innerHTML = ''; el.classList.toggle('ro', !!ro); opts.forEach(([v, l]) => { const b = document.createElement('button'); b.textContent = l; if (String(v) === String(cur)) b.classList.add('on'); if (!ro) b.onclick = () => { [...el.children].forEach(c => c.classList.remove('on')); b.classList.add('on'); on(v) }; el.appendChild(b) }) }
const GUN_SVG = { smg: [[20, 16, 52, 12], [72, 19, 22, 5], [40, 28, 8, 17], [58, 28, 7, 10], [6, 18, 16, 6], [30, 11, 18, 5]], ar: [[4, 18, 22, 9], [26, 15, 56, 11], [82, 18, 34, 4], [48, 26, 7, 16], [64, 26, 7, 10], [38, 10, 22, 5]], sniper: [[2, 19, 26, 8], [28, 16, 50, 9], [78, 18, 40, 3], [50, 25, 6, 9], [62, 25, 6, 10], [32, 7, 30, 7]], shotgun: [[2, 20, 30, 9], [32, 17, 40, 9], [72, 18, 44, 4], [62, 23, 40, 5], [40, 26, 7, 10]], dmr: [[4, 18, 24, 9], [28, 15, 52, 10], [80, 18, 36, 4], [52, 25, 8, 14], [64, 25, 7, 9], [34, 7, 28, 6]] };
export function gunSvg(k, col) { const id = 'g' + k + Math.random().toString(36).slice(2, 6); return `<svg viewBox="0 0 120 50"><defs><linearGradient id="${id}" x1="0" x2="1"><stop offset="0" stop-color="#e8eaee"/><stop offset="1" stop-color="${col || CLS[k].col}"/></linearGradient></defs>${GUN_SVG[k].map(r => `<rect x="${r[0]}" y="${r[1]}" width="${r[2]}" height="${r[3]}" rx="1.5" fill="url(#${id})"/>`).join('')}</svg>` }
const statBars = k => { const n = ['DAMAGE', 'RANGE', 'FIRE RATE', 'MOBILITY']; return CLS[k].st.map((v, i) => `<div class="stat"><span>${n[i]}</span><div class="bar"><i style="width:${v * 100}%;background:${CLS[k].col}"></i></div></div>`).join('') };
const pwHtml = k => { const p = CLS[k].pw; return `<div class="pw"><div class="pi" style="background:${CLS[k].col}22;color:${CLS[k].col}">${p.ic}</div><div><b>${p.n} <span style="opacity:.5;font-size:10px">· ${isTouch ? 'PWR' : keyLabel(S.keys.power)}</span></b><small>${p.d} · ${p.cd}s cooldown</small></div></div>` };
export function status(t) { $('status').textContent = t }
let toastT = 0; export function toast(t) { const e = $('toast'); e.textContent = t; e.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('show'), 2600) }
export function openModal(id) { $(id).classList.remove('hidden'); if (document.pointerLockElement) document.exitPointerLock() }
export function closeModal(id) { $(id).classList.add('hidden') }
function copyInvite() { if (!NET.room) { toast('Practice match — create a private room to invite friends'); return } const link = location.protocol.startsWith('http') ? location.origin + location.pathname + '?room=' + NET.room : NET.room;
  (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(() => toast('Invite copied: ' + link)).catch(() => toast('Room code: ' + NET.room)) }

// ---------- home ----------
function renderCarousel() { const k = S.cls, Wc = CLS[k]; $('carBody').innerHTML = `${gunSvg(k)}<div class="cname">${Wc.n.toUpperCase()}</div><div class="cfull">${Wc.full} · ${Wc.range.toUpperCase()} · ${Wc.mag} RDS</div>${pwHtml(k)}<div style="margin-top:8px">${statBars(k)}</div>` }
function xpInfo() { const xp = ST.k * 10 + ST.w * 60 + ST.m * 20 + ST.hs * 5, lvl = Math.floor(Math.sqrt(xp / 120)) + 1, a = (lvl - 1) ** 2 * 120, b = lvl ** 2 * 120; return { lvl, p: (xp - a) / (b - a) } }
function renderProfile() { const x = xpInfo(); $('ava').textContent = (S.name || 'G')[0].toUpperCase(); $('ava').style.background = S.col; $('profName').textContent = S.name || 'ghost'; $('profLvl').textContent = 'LEVEL ' + x.lvl; $('xpBar').style.width = (x.p * 100) + '%' }
function renderCareer() { const t = [[ST.k, 'KILLS'], [(ST.k / Math.max(1, ST.d)).toFixed(2), 'K/D'], [ST.w, 'WINS'], [ST.m, 'MATCHES'], [ST.hs, 'HEADSHOTS'], [ST.best, 'BEST STREAK']]; $('career').innerHTML = t.map(([v, l]) => `<div><b>${v}</b><small>${l}</small></div>`).join('') }
function renderMapStrip() { const el = $('mapStrip'); el.innerHTML = ''; MK.forEach(k => { const m = MAPS[k], d = document.createElement('div'); d.className = 'mcard' + (k === S.lastMap ? ' on' : ''); d.style.background = m.card;
  d.innerHTML = `<span class="em">${m.em}</span><span class="ty">${m.tag.split(' · ')[0]}</span><b>${m.name}</b><small>${m.tag}</small>`; d.title = m.desc;
  d.onclick = () => { S.lastMap = k; saveS(); [...el.children].forEach(c => c.classList.remove('on')); d.classList.add('on'); buildWorld(k); resetMenuCam() }; el.appendChild(d) }) }
const classLocked = () => GS.inGame && (R.mode === 'gun' || R.mode === 'snipe');
function setClass(k) { if (classLocked()) { toast('Class is locked in ' + MODES[R.mode].n); return false } S.cls = k; saveS(); renderCarousel(); renderClassGrid(); sendCls(); return true }
function renderClassGrid() { $('classGrid').innerHTML = CK.map(k => { const Wc = CLS[k]; return `<div class="cc${k === S.cls ? ' on' : ''}" data-k="${k}">${gunSvg(k)}<div class="cname">${Wc.n}</div><div class="meta">Range: <b>${Wc.range}</b> · Ammo: <b>${Wc.mag}</b><br>Reload: <b>${(Wc.rl / 1000).toFixed(2)}s</b></div>${pwHtml(k)}<div style="margin-top:6px">${statBars(k)}</div></div>` }).join('');
  [...$('classGrid').children].forEach(c => c.onclick = () => { if (setClass(c.dataset.k)) { toast(CLS[S.cls].n + ' selected' + (GS.inGame ? ' — applies on respawn' : '')); setTimeout(() => closeModal('classModal'), 180) } }) }

// ---------- settings ----------
const TABS = [['game', 'GAMEPLAY'], ['keys', 'CONTROLS'], ['touch', 'TOUCH'], ['video', 'VIDEO'], ['hud', 'HUD & AUDIO']];
const SET = {
  game: [{ k: 'pov', l: 'Camera view', d: 'First person or over-the-shoulder third person.', t: 'seg', o: [['fp', '1st Person'], ['tp', '3rd Person']] },
    { k: 'adsToggle', l: 'Aim / scope', t: 'seg', o: [[false, 'Hold'], [true, 'Toggle']] }, { k: 'sprintToggle', l: 'Sprint', d: 'Sprint + crouch = slide.', t: 'seg', o: [[false, 'Hold'], [true, 'Toggle']] },
    { k: 'autoRl', l: 'Auto reload', d: 'Reload automatically when empty.', t: 'tog' },
    { note: 'Aim assist and auto-fire are chosen by the room host before the match and are the same for every player — no one can turn them on alone.' }],
  keys: [{ k: 'sens', l: 'Mouse sensitivity', t: 'rng', min: .2, max: 4, st: .05 }, { k: 'adsSens', l: 'Scope sensitivity', d: 'Multiplier while aiming / scoped.', t: 'rng', min: .2, max: 2, st: .05 }, { k: 'invY', l: 'Invert Y-axis', t: 'tog' }, { binds: 1 }],
  touch: [{ k: 'touchScale', l: 'Button size', t: 'rng', min: .75, max: 1.4, st: .05 }, { k: 'leftFire', l: 'Extra fire button (left side)', t: 'tog' }, { k: 'leftHanded', l: 'Left-handed layout', d: 'Mirror the joystick and buttons.', t: 'tog' }, { k: 'sens', l: 'Look sensitivity', t: 'rng', min: .2, max: 4, st: .05 }],
  video: [{ k: 'bright', l: 'Brightness', d: 'Lower this if the screen feels too bright.', t: 'rng', min: .5, max: 1.4, st: .05 },
    { k: 'q', l: 'Graphics quality', d: 'Performance = smooth on phones / older laptops.', t: 'seg', o: [['low', 'Performance'], ['med', 'Balanced'], ['high', 'High']], reload: 1 },
    { k: 'fov', l: 'Field of view', t: 'rng', min: 65, max: 110, st: 1 }, { k: 'shake', l: 'Screen shake', t: 'tog' }, { k: 'bob', l: 'Weapon / head bob', t: 'tog' }, { k: 'fps', l: 'Show FPS', t: 'tog' }],
  hud: [{ k: 'xh', l: 'Crosshair', t: 'seg', o: [['cross', 'Cross'], ['dot', 'Dot'], ['circle', 'Circle'], ['t', 'T-Shape']] }, { k: 'xhc', l: 'Crosshair colour', t: 'col', o: ['#c4f25a', '#4cc9f0', '#ff5a7e', '#ffffff', '#ffd166', '#c084fc'] },
    { k: 'dmgn', l: 'Damage numbers', t: 'tog' }, { k: 'vol', l: 'Master volume', t: 'rng', min: 0, max: 1, st: .05 }]
};
let curTab = 'game';
export function renderSettings(tab) {
  if (tab) curTab = tab; const tb = $('setTabs'); tb.innerHTML = '';
  TABS.forEach(([k, l]) => { if (k === 'touch' && !isTouch) return; if (k === 'keys' && isTouch) l = 'SENSITIVITY'; const b = document.createElement('button'); b.textContent = l; if (k === curTab) b.className = 'on'; b.onclick = () => renderSettings(k); tb.appendChild(b) });
  const b = $('setBody'); b.innerHTML = '';
  for (const s of SET[curTab]) {
    if (s.note) { const n = document.createElement('div'); n.className = 'note'; n.textContent = s.note; b.appendChild(n); continue }
    if (s.binds) { if (isTouch) continue; const h = document.createElement('div'); h.className = 'note'; h.textContent = 'Click a key to change it, then press the new key or mouse button.'; b.appendChild(h);
      for (const [a, label] of ACTIONS) { const row = document.createElement('div'); row.className = 'srow'; row.innerHTML = `<div class="sl">${label}</div><div class="sc"><button class="kb">${keyLabel(S.keys[a])}</button></div>`; row.querySelector('.kb').onclick = () => startBinding(a, label); b.appendChild(row) }
      const rs = document.createElement('button'); rs.className = 'btn ghost'; rs.style.marginTop = '14px'; rs.textContent = 'RESET TO DEFAULT KEYS'; rs.onclick = () => { S.keys = { ...DEFAULT_KEYS }; saveS(); rebuildKeyMap(); renderSettings('keys'); toast('Keys reset') }; b.appendChild(rs); continue }
    const row = document.createElement('div'); row.className = 'srow'; row.innerHTML = `<div class="sl">${s.l}${s.d ? `<small>${s.d}</small>` : ''}</div><div class="sc"></div>`; const c = row.querySelector('.sc');
    const set = v => { S[s.k] = v; saveS(); applySettings(); if (s.reload) { if (!GS.inGame && !GS.G && !NET.hostConn) location.reload(); else toast('Graphics quality applies next time you open the game') } };
    if (s.t === 'seg') { const e = document.createElement('div'); e.className = 'seg'; e.style.flex = '1'; c.appendChild(e); seg(e, s.o, S[s.k], set) }
    else if (s.t === 'tog') { const e = document.createElement('button'); e.className = 'tog' + (S[s.k] ? ' on' : ''); e.onclick = () => { e.classList.toggle('on'); set(e.classList.contains('on')) }; c.appendChild(e) }
    else if (s.t === 'rng') { c.innerHTML = `<input type="range" min="${s.min}" max="${s.max}" step="${s.st}" value="${S[s.k]}"><span class="v">${(+S[s.k]).toFixed(s.st < 1 ? 2 : 0)}</span>`; const i = c.querySelector('input'), v = c.querySelector('.v'); i.oninput = () => { v.textContent = (+i.value).toFixed(s.st < 1 ? 2 : 0); set(+i.value) } }
    else if (s.t === 'col') { const e = document.createElement('div'); e.className = 'colsw'; s.o.forEach(col => { const i = document.createElement('i'); i.style.background = col; if (col === S[s.k]) i.className = 'on'; i.onclick = () => { [...e.children].forEach(x => x.className = ''); i.className = 'on'; set(col) }; e.appendChild(i) }); c.appendChild(e) }
    b.appendChild(row)
  }
}
export function applySettings() {
  buildCrosshair(); $('fps').classList.toggle('hidden', !S.fps); setVolume(); applyExposure();
  $('povChip').textContent = (S.pov === 'tp' ? '3RD PERSON' : '1ST PERSON') + (isTouch ? '' : ' · ' + keyLabel(S.keys.pov));
  document.documentElement.style.setProperty('--bs', S.touchScale); document.body.classList.toggle('lefty', !!S.leftHanded); $('mFire2').classList.toggle('hidden', !S.leftFire)
}
function buildCrosshair() { const x = $('xh'); x.style.setProperty('--xc', S.xhc);
  if (S.xh === 'dot') x.innerHTML = '<i style="width:6px;height:6px;left:-3px;top:-3px;border-radius:50%"></i>';
  else if (S.xh === 'circle') x.innerHTML = '<i class="ring" id="xr" style="width:28px;height:28px;left:-14px;top:-14px"></i><i style="width:4px;height:4px;left:-2px;top:-2px;border-radius:50%"></i>';
  else x.innerHTML = `<i style="width:3px;height:3px;left:-1.5px;top:-1.5px"></i>${S.xh === 't' ? '' : '<i id="x1" style="width:2px;height:9px;left:-1px"></i>'}<i id="x2" style="width:2px;height:9px;left:-1px"></i><i id="x3" style="height:2px;width:9px;top:-1px"></i><i id="x4" style="height:2px;width:9px;top:-1px"></i>` }

// ---------- init ----------
export function initMenu() {
  setGunIcon(gunSvg);
  S.name = S.name || ('ghost' + (Math.random() * 900 + 100 | 0)); $('nameIn').value = S.name; $('nameIn').oninput = e => { S.name = e.target.value.trim().slice(0, 14) || 'ghost'; saveS(); renderProfile() };
  const sw = $('swatches'); PALETTE.forEach(c => { const d = document.createElement('div'); d.className = 'sw' + (c === S.col ? ' on' : ''); d.style.background = c; d.onclick = () => { S.col = c; saveS(); [...sw.children].forEach(x => x.classList.remove('on')); d.classList.add('on'); renderProfile() }; sw.appendChild(d) });
  const cyc = dir => { const i = CK.indexOf(S.cls); setClass(CK[(i + dir + CK.length) % CK.length]) }; $('cPrev').onclick = () => cyc(-1); $('cNext').onclick = () => cyc(1);
  renderCarousel(); renderClassGrid(); renderSettings(); applySettings(); renderProfile(); renderCareer(); renderMapStrip(); $('verTxt').textContent = GAME.name + ' v' + GAME.version;
  const openSet = () => { renderSettings(); openModal('settingsModal') };
  $('tabLoadout').onclick = $('lClassBtn').onclick = () => { renderClassGrid(); openModal('classModal') }; $('tabSettings').onclick = $('mSetBtn').onclick = openSet;
  $('soloBtn').onclick = () => { ac(); startHost(false) }; $('hostBtn').onclick = () => { ac(); startHost(true) };
  $('joinBtn').onclick = () => { ac(); const c = $('codeIn').value.trim().toUpperCase(); if (c.length < 4) { status('Enter a room code'); return } joinRoom(c) };
  $('codeIn').onkeydown = e => { if (e.key === 'Enter') $('joinBtn').click() };
  const q = new URLSearchParams(location.search).get('room'); if (q) $('codeIn').value = q.toUpperCase().slice(0, 5);
  $('switchBtn').onclick = () => { if (NET.isHost) hostSwitch(NET.myId); else sendToHost({ t: 'team' }) };
  $('copyBtn').onclick = $('lobRoom').onclick = copyInvite; $('lobLeave').onclick = () => { location.href = location.pathname };
  $('readyBtn').onclick = () => { if (NET.isHost) hostStart(); else if (GS.LB) { const mine = GS.LB.pl.find(p => p[0] === NET.myId); sendToHost({ t: 'rdy', v: !(mine && mine[4]) }) } };
  $('lobChatIn').onkeydown = e => { if (e.key === 'Enter') { sendChat(e.target.value); e.target.value = '' } };
  $('botsIn').oninput = e => { $('botsV').textContent = e.target.value; if (NET.isHost) hostSetCfg('bots', +e.target.value) };
  $('resumeBtn').onclick = () => { closeModal('pause'); GS.paused = false; if (!isTouch) cv.requestPointerLock() };
  $('pClassBtn').onclick = $('dClassBtn').onclick = () => { renderClassGrid(); openModal('classModal') };
  $('pSetBtn').onclick = $('dSetBtn').onclick = openSet;
  $('pInvBtn').onclick = $('roomChip').onclick = copyInvite; $('leaveBtn').onclick = () => { location.href = location.pathname };
  $('pauseBtn').onclick = () => { GS.paused = true; openModal('pause') }; $('povChip').onclick = () => togglePov();
  $('respawnBtn').onclick = () => reqRespawn();
  document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => closeModal(b.dataset.close));
  $('loading').classList.add('hidden'); $('menu').classList.remove('hidden'); setTimeout(() => fillAds($('menu')), 400)
}

// ---------- lobby ----------
export function renderLobby(st) {
  GS.LB = st; if (!st) return; const c = st.cfg, mode = MODES[c.mode], m = MAPS[c.map];
  $('lobRoom').innerHTML = st.room ? `<span class="dot"></span>PRIVATE ROOM · <b style="letter-spacing:3px">${st.room}</b> · copy invite` : '<span class="dot" style="background:var(--gold)"></span>PRACTICE · OFFLINE';
  $('copyBtn').classList.toggle('hidden', !st.room);
  $('lobThumb').style.background = m.card; $('lobMap').textContent = m.name; $('lobSub').textContent = `${mode.n} · ${c.time} min · ${mode.desc}`;
  const aimTxt = { manual: 'MANUAL AIM', assist: 'AIM ASSIST', auto: 'AUTO-AIM' }[c.aim], fireTxt = c.fire === 'auto' ? 'AUTO-FIRE' : 'MANUAL FIRE';
  $('lobRules').innerHTML = `<span>🎯 ${aimTxt}</span><span>🔫 ${fireTxt}</span><span>${m.em} ${m.tag}</span>`;
  const pr = p => { const [id, name, col, team, ready, bot, cls] = p, host = id === st.host; return `<div class="pr${id === NET.myId ? ' me' : ''}"><span style="color:${col}">●</span>${esc(name)}${host ? '<span class="b2">HOST</span>' : ''}${bot ? '<span class="b2">BOT</span>' : ''}${id === NET.myId ? '<span class="b2">YOU</span>' : ''}<span class="b2" style="opacity:.7">${CLS[cls] ? CLS[cls].n : ''}</span><span class="rd ${host || bot || ready ? 'y' : 'n'}">${host ? '' : bot || ready ? 'READY' : 'NOT READY'}</span></div>` };
  const T = $('teams');
  if (mode.teams) { T.className = 'teams'; T.innerHTML = [0, 1].map(t => `<div class="tcol"><div class="th" style="background:${TEAMC[t]}">TEAM ${TEAMN[t]}</div><div class="tl">${st.pl.filter(p => p[3] === t).map(pr).join('') || '<div style="opacity:.4;padding:10px;text-align:center">empty</div>'}</div></div>`).join('') }
  else { T.className = 'teams solo'; T.innerHTML = `<div class="tcol"><div class="th" style="background:rgba(255,255,255,.1)">PLAYERS · ${st.pl.length}/${mode.max}</div><div class="tl">${st.pl.map(pr).join('')}</div></div>` }
  $('switchBtn').classList.toggle('hidden', !mode.teams);
  const humans = st.pl.filter(p => !p[5]), readyN = humans.filter(p => p[4] || p[0] === st.host).length, rb = $('readyBtn');
  if (NET.isHost) { rb.textContent = 'START MATCH'; rb.className = 'btn pri'; $('lobInfo').textContent = `${readyN}/${humans.length} players ready` + (st.room ? ` · share code ${st.room} with friends` : '') }
  else { const mine = st.pl.find(p => p[0] === NET.myId), r = mine && mine[4]; rb.textContent = r ? 'READY ✓ (tap to cancel)' : 'READY'; rb.className = 'btn pri' + (r ? ' isReady' : ''); $('lobInfo').textContent = 'Waiting for host to start · ' + readyN + '/' + humans.length + ' ready' }
  const ro = !NET.isHost; $('setTitle').textContent = ro ? 'Match settings (host controls)' : 'Match settings';
  seg($('modeSeg'), MK2.map(k => [k, MODES[k].n]), c.mode, v => hostSetCfg('mode', v), ro);
  seg($('aimSeg'), [['manual', 'Manual'], ['assist', 'Assist'], ['auto', 'Auto-Aim']], c.aim, v => hostSetCfg('aim', v), ro);
  seg($('fireSeg'), [['manual', 'Manual'], ['auto', 'Auto-Fire']], c.fire, v => hostSetCfg('fire', v), ro);
  seg($('timeSeg'), [[3, '3 min'], [5, '5 min'], [10, '10 min']], c.time, v => hostSetCfg('time', +v), ro);
  seg($('diffSeg'), [['easy', 'Chill'], ['normal', 'Mid'], ['hard', 'Sweaty']], c.diff, v => hostSetCfg('diff', v), ro);
  const mg = $('maps'); mg.innerHTML = ''; MK.forEach(k => { const mm = MAPS[k], d = document.createElement('div'); d.className = 'mapc' + (k === c.map ? ' on' : '') + (ro ? ' ro' : ''); d.style.background = mm.card; d.innerHTML = `<b>${mm.name}</b><small>${mm.tag}</small>`; if (!ro) d.onclick = () => hostSetCfg('map', k); mg.appendChild(d) });
  const bi = $('botsIn'); bi.disabled = ro; bi.max = c.mode === 'duel' ? 1 : 9; if (document.activeElement !== bi) bi.value = c.bots; $('botsV').textContent = c.bots;
  if (W.MAPID !== c.map) buildWorld(c.map)
}
export function onChat(msg) {
  const line = document.createElement('div'); line.className = 'cm' + (msg.sys ? ' sys' : ''); line.innerHTML = msg.sys ? esc(msg.sys) : `<b style="color:${msg.c}">${esc(msg.n)}:</b>${esc(msg.m)}`;
  const box = $('chatBox'); box.appendChild(line); while (box.children.length > 80) box.firstChild.remove(); box.scrollTop = 1e9;
  const gl = $('chatLog'), l2 = line.cloneNode(true); gl.appendChild(l2); while (gl.children.length > 6) gl.firstChild.remove(); setTimeout(() => l2.style.opacity = 0, 7000); setTimeout(() => l2.remove(), 8000)
}
