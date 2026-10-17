// =====================================================================
//  Networking: PeerJS WebRTC. Host's browser runs the game; clients send input.
//  Messages: join, w (welcome), lb (lobby), go (start), s (snapshot), i (input), c (chat), team, rdy, cls, full
// =====================================================================
import { S, CLS, PALETTE, MODES, NETCFG } from '../config.js';
import { $ } from '../util.js';
import { NET, GS } from '../state.js';
import { status, toast, renderLobby, onChat } from '../ui/menu.js';
import { hostCreate, newPlayer, pickTeam, syncBots, broadcastLobby, hostSwitch, hostChat, hostSys, applyInput, spawn } from './host.js';
import { onSnap, enterGame, showLobby, localInput } from './client.js';
import { buildWorld } from '../render/world.js';

const genCode = () => { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 5; i++) s += c[Math.random() * c.length | 0]; return s };

export function startHost(online) {
  NET.isHost = true;
  if (!online) { NET.room = null; hostCreate(false); return }
  if (typeof Peer === 'undefined') { status('Network library failed to load — check internet.'); return }
  NET.room = genCode(); status('Creating private room…'); const peer = NET.peer = new Peer(NETCFG.prefix + NET.room, { debug: 0 });
  peer.on('open', () => { status(''); hostCreate(true) });
  peer.on('error', e => { if (e.type === 'unavailable-id') { peer.destroy(); startHost(true) } else if (!GS.G) status('Error: ' + e.type); else toast('Network: ' + e.type) });
  peer.on('disconnected', () => { try { peer.reconnect() } catch (e) { } });
  peer.on('connection', conn => {
    conn.on('data', d => hostOnData(conn, d));
    const drop = () => { const G = GS.G; if (conn._gid != null && G) { const p = G.players.get(conn._gid); if (p) hostSys(p.name + ' left'); G.players.delete(conn._gid); NET.conns.delete(conn._gid); conn._gid = null; if (G.phase === 'lobby') { syncBots(); broadcastLobby() } } };
    conn.on('close', drop); conn.on('error', drop)
  })
}
function hostOnData(conn, d) {
  const G = GS.G; if (!d || !G) return;
  if (d.t === 'join') {
    if (conn._gid != null) return; const humans = [...G.players.values()].filter(p => !p.bot).length, mode = MODES[G.cfg.mode];
    if (humans >= Math.min(NETCFG.maxConn, mode.max)) { conn.send({ t: 'full', why: mode.max === 2 ? 'This room is set to 1v1 and already has 2 players.' : 'Room is full.' }); return }
    const id = GS.nextId++; conn._gid = id; NET.conns.set(id, conn);
    const p = newPlayer(id, String(d.name || 'player'), PALETTE.includes(d.col) ? d.col : PALETTE[0], false, CLS[d.cls] ? d.cls : 'ar');
    p.team = pickTeam(); G.players.set(id, p); conn.send({ t: 'w', id }); hostSys(p.name + ' joined'); syncBots();
    if (G.phase !== 'lobby') { spawn(p, performance.now()); conn.send({ t: 'go', map: G.cfg.map, mode: G.cfg.mode, aim: G.cfg.aim, fire: G.cfg.fire }) } else broadcastLobby();
    return
  }
  if (conn._gid == null) return;
  const p = G.players.get(conn._gid);
  if (d.t === 'i') { if (p) applyInput(p, d) }
  else if (d.t === 'team') hostSwitch(conn._gid);
  else if (d.t === 'rdy') { if (p) { p.ready = !!d.v; broadcastLobby() } }
  else if (d.t === 'cls') { if (p && CLS[d.v]) { p.next = d.v; if (G.phase === 'lobby') { p.cls = d.v; broadcastLobby() } } }
  else if (d.t === 'c') hostChat(conn._gid, d.m)
}
export function joinRoom(code) {
  if (typeof Peer === 'undefined') { status('Network library failed to load — check internet.'); return }
  NET.isHost = false; NET.room = code; status('Connecting to ' + code + '…'); const peer = NET.peer = new Peer({ debug: 0 });
  peer.on('open', () => {
    const hc = NET.hostConn = peer.connect(NETCFG.prefix + code, { reliable: true, serialization: 'json' });
    hc.on('open', () => hc.send({ t: 'join', name: S.name, col: S.col, cls: S.cls })); hc.on('data', onClientData);
    hc.on('close', () => { if (NET.myId != null) { alert('The host closed the room.'); location.href = location.pathname } });
    setTimeout(() => { if (NET.myId == null) status('Could not reach room ' + code + '. Check the code — the host must keep the game open.') }, 12000)
  });
  peer.on('error', e => { if (NET.myId == null) status(e.type === 'peer-unavailable' ? 'Room not found — check the code' : 'Error: ' + e.type); else toast('Network: ' + e.type) })
}
let lastLb = '';
function onClientData(d) {
  if (!d) return;
  if (d.t === 'w') { NET.myId = d.id; status(''); $('menu').classList.add('hidden'); $('lobby').classList.remove('hidden'); NET.sendTimer = setInterval(() => { if (GS.inGame && NET.hostConn && NET.hostConn.open) NET.hostConn.send(localInput()) }, 33) }
  else if (d.t === 'lb') { const js = JSON.stringify(d), fresh = GS.inGame || $('lobby').classList.contains('hidden'); if (fresh) { GS.LB = d; showLobby() } if (fresh || js !== lastLb) { lastLb = js; renderLobby(d) } }
  else if (d.t === 'go') { buildWorld(d.map); enterGame(d) }
  else if (d.t === 's') onSnap(d);
  else if (d.t === 'c') onChat(d);
  else if (d.t === 'full') { status(d.why || 'Room is full'); try { NET.peer.destroy() } catch (e) { } }
}
export function sendToHost(msg) { if (NET.hostConn && NET.hostConn.open) NET.hostConn.send(msg) }
export function sendCls() {
  if (!NET.isHost) sendToHost({ t: 'cls', v: S.cls });
  else if (GS.G) { const p = GS.G.players.get(NET.myId); if (p) { p.next = S.cls; if (GS.G.phase === 'lobby') { p.cls = S.cls; broadcastLobby(true) } } }
}
export function sendChat(m) { m = String(m || '').trim(); if (!m) return; if (NET.isHost) hostChat(NET.myId, m); else sendToHost({ t: 'c', m }) }
